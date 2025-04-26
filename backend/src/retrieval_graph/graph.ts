import { StateGraph, START, END } from '@langchain/langgraph';
// ToolNode is no longer needed here if we call the tool directly
// import { ToolNode } from "@langchain/langgraph/prebuilt"; 
import { AgentStateAnnotation } from './state.js';
import { makeRetriever } from '../shared/retrieval.js';
import { formatDocs } from './utils.js';
// ToolMessage might still be needed if generateResponse formats the output
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages'; 
import { z } from 'zod';
import {
  RESPONSE_SYSTEM_PROMPT,
  ROUTER_SYSTEM_PROMPT,
  DIRECT_ANSWER_PROMPT,
} from './prompts.js';
import { RunnableConfig } from '@langchain/core/runnables';
import {
  AgentConfigurationAnnotation,
  ensureAgentConfiguration,
} from './configuration.js';
import { loadChatModel } from '../shared/utils.js';
import { getWeatherTool } from './tools.js'; // Import the tool

// Tools list might not be needed for binding anymore
// const tools = [getWeatherTool];

// loadAndBindModel is no longer needed if we don't bind tools
// async function loadAndBindModel(config: RunnableConfig) { ... }

// --- Graph Nodes --- 

async function checkQueryType(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
): Promise<{
  route: 'retrieve' | 'direct' | 'checkWeather'; // Added checkWeather route
}> {
  const query = state.query.toLowerCase();
  // Explicit check for the keyword "buiten"
  if (query.includes('buiten')) {
    console.log("Keyword 'buiten' detected. Routing to checkWeather.");
    return { route: 'checkWeather' };
  }

  // Only call LLM router if keyword is not found
  console.log("Keyword 'buiten' not found. Calling LLM router.");
  const schema = z.object({
    route: z.enum(['retrieve', 'direct']),
  });
  const configuration = ensureAgentConfiguration(config);
  const model = await loadChatModel(configuration.queryModel);
  const routingPrompt = ROUTER_SYSTEM_PROMPT;
  const response = await routingPrompt
    .pipe(model.withStructuredOutput(schema))
    .invoke({ query: state.query });

  // Return LLM decision
  return { route: response.route };
}

// New node to execute the weather tool directly
async function checkWeather(
  state: typeof AgentStateAnnotation.State,
): Promise<typeof AgentStateAnnotation.Update> {
  console.log("Executing weather tool.");
  try {
    const toolResult = await getWeatherTool.invoke({}); 
    // Return the result in the new state field
    return { weather_result: toolResult };
  } catch (error: any) {
      console.error("Error executing weather tool:", error);
      const errorMessage = `Fout bij uitvoeren weer-tool: ${error.message || 'Onbekende fout'}`;
      // Return the error message in the new state field
      return { weather_result: errorMessage }; 
  }
}

async function answerQueryDirectly(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
): Promise<typeof AgentStateAnnotation.Update> {
  // No need to bind tools here anymore
  const configuration = ensureAgentConfiguration(config);
  const model = await loadChatModel(configuration.queryModel);
  const promptTemplate = DIRECT_ANSWER_PROMPT;

  const response = await promptTemplate.pipe(model).invoke({
    question: state.query,
    chat_history: state.messages,
  });

  return { messages: response }; 
}

async function retrieveDocuments(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
): Promise<typeof AgentStateAnnotation.Update> {
  const retriever = await makeRetriever(config);
  const response = await retriever.invoke(state.query);
  return { documents: response };
}

async function generateResponse(
  state: typeof AgentStateAnnotation.State,
  config: RunnableConfig,
): Promise<typeof AgentStateAnnotation.Update> {
  const configuration = ensureAgentConfiguration(config);
  const model = await loadChatModel(configuration.queryModel);
  const context = formatDocs(state.documents);
  const promptTemplate = RESPONSE_SYSTEM_PROMPT;
  const weatherResult = state.weather_result ?? "Niet beschikbaar"; // Get weather result or default

  console.log("--- History Sent to LLM in generateResponse ---");
  console.log(state.messages);
  console.log("---------------------------------------------");
  console.log("--- Context Sent to LLM in generateResponse ---");
  console.log(context);
  console.log("---------------------------------------------");
  console.log("--- Weather Result Sent to LLM in generateResponse ---");
  console.log(weatherResult);
  console.log("--------------------------------------------------");

  // Pass weather result to the prompt invoke
  const response = await promptTemplate.pipe(model).invoke({
    question: state.query, 
    context: context,
    chat_history: state.messages,
    weather_result: weatherResult, // Add weather result here
  });

  // Return AIMessage and clear the weather_result from state if it was used
  return { messages: response, weather_result: null }; 
}


// --- Conditional Routing --- 

function routeQuery(
  state: typeof AgentStateAnnotation.State,
): 'retrieveDocuments' | 'directAnswer' | 'checkWeather' { // Added checkWeather
  const route = state.route;
  if (!route) throw new Error('Route is not set');
  if (route === 'checkWeather') return 'checkWeather'; // Route to new node
  if (route === 'retrieve') return 'retrieveDocuments';
  if (route === 'direct') return 'directAnswer';
  throw new Error('Invalid route: ' + route);
}



// --- Build Graph --- 

const builder = new StateGraph(
  AgentStateAnnotation,
  AgentConfigurationAnnotation,
)
  .addNode('checkQueryType', checkQueryType)
  .addNode('checkWeather', checkWeather) // Add new node
  .addNode('retrieveDocuments', retrieveDocuments)
  .addNode('generateResponse', generateResponse)
  .addNode('directAnswer', answerQueryDirectly)
  // .addNode('executeTools', toolExecutor) // Remove tool executor node

  .addEdge(START, 'checkQueryType')
  // Updated conditional edges from checkQueryType
  .addConditionalEdges('checkQueryType', routeQuery, {
    checkWeather: 'checkWeather',
    retrieveDocuments: 'retrieveDocuments',
    directAnswer: 'directAnswer',
  })
  // Edge from weather check goes to generateResponse to formulate final answer
  .addEdge('checkWeather', 'generateResponse') 
  .addEdge('retrieveDocuments', 'generateResponse')

  // Edges from LLM nodes go directly to END now
  .addEdge('generateResponse', END)
  .addEdge('directAnswer', END);
  // Remove edges related to executeTools and routeAfterLLM

export const graph = builder.compile().withConfig({
  runName: 'RetrievalGraphWithExplicitWeatherTool', // Renamed run
});
