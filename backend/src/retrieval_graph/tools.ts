import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import fetch from 'node-fetch'; // Need to import fetch for Node.js

// Helper function to call WeatherAPI
async function fetchWeatherData(apiKey: string | undefined): Promise<any> {
  if (!apiKey) {
    throw new Error('WEATHER_API_KEY is not set in environment variables.');
  }
  const location = 'Rotterdam';
  const days = 1;
  const url = `http://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${location}&days=${days}&aqi=no&alerts=no`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`WeatherAPI request failed with status ${response.status}: ${await response.text()}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching weather data:", error);
    throw error; // Re-throw the error to be caught by the graph
  }
}

// Define the LangChain tool
export const getWeatherTool = tool(
  async () => {
    // Fetch weather data using the API key from environment variables
    const apiKey = process.env.WEATHER_API_KEY;
    try {
      const weatherData = await fetchWeatherData(apiKey);

      // Process the data
      const forecast = weatherData?.forecast?.forecastday?.[0]?.day;
      if (!forecast) {
        return "Kon geen weersvoorspelling ophalen voor Rotterdam.";
      }

      const maxTemp = forecast.maxtemp_c;
      const chanceOfRain = forecast.daily_chance_of_rain; // Percentage
      const conditionText = forecast.condition?.text;

      // Determine if suitable for outdoor exercise
      const isSuitable = maxTemp > 15 && chanceOfRain < 40; // Using < 40% chance of rain as threshold

      let result = `Weerbericht Rotterdam: Max temp ${maxTemp}°C, Regenkans ${chanceOfRain}%.`;
      if (conditionText) {
        result += ` Verwachting: ${conditionText}.`;
      }
      if (isSuitable) {
        result += " Het weer lijkt geschikt voor buitensporten.";
      } else {
        result += " Het weer is mogelijk niet ideaal voor buitensporten (te koud of te hoge regenkans). Overweeg binnen te sporten.";
      }
      return result;

    } catch (error: any) {
        console.error("Error in getWeatherTool:", error);
        return `Fout bij ophalen weerbericht: ${error.message || 'Onbekende fout'}`;
    }
  },
  {
    name: "get_rotterdam_weather",
    description: "Haalt het weerbericht voor vandaag op voor Rotterdam, Nederland. Gebruik deze tool ALTIJD als de gebruiker het heeft over het weer in Rotterdam, of over buiten sporten, trainen, hardlopen, wandelen of andere buitenactiviteiten in Rotterdam.",
    schema: z.object({}), // No input schema needed as location is fixed
  },
); 