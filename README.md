# HyroCoach - AI Fitness Coach Chatbot

HyroCoach is een AI-gestuurde chatbot ontworpen als je persoonlijke fitnesscoach. Upload je trainingsschema's of voedingsgidsen (als PDF), en HyroCoach gebruikt deze documenten om je vragen te beantwoorden en gepersonaliseerd advies te geven via een chatinterface.

De kern van de chatbot wordt gevormd door OpenAI's taalmodellen, georkestreerd met LangChain en LangGraph. Voor het opslaan en efficiënt doorzoeken van je documenten (via RAG - Retrieval-Augmented Generation) wordt Supabase als vector database gebruikt.

## Features

*   **PDF Verwerking & RAG**: Upload PDF's, die worden verwerkt en opgeslagen in Supabase voor snelle informatieherkenning.
*   **Intelligente Chat**: Stelt vragen, begrijpt context, haalt relevante informatie uit je documenten op en geeft antwoord.
*   **Weer Integratie**: Kan het actuele weer in Rotterdam opvragen als je over buiten sporten praat.
*   **Streaming Reacties**: Antwoorden verschijnen direct in de chatinterface via streaming.
*   **Moderne Tech Stack**: Gebouwd met Next.js (React) voor de frontend en Node.js/TypeScript met LangGraph voor de backend.

## Architectuur

De applicatie bestaat uit een frontend (webinterface) en een backend (API):

```ascii
┌─────────────────┐      Upload PDF / Stel Vraag     ┌───────────────────┐
│ Frontend        │ <───────────────────────────────> │ Backend           │
│ (Next.js/React) │       Antwoord / Bevestiging      │ (Node/LangGraph)  │
│                 │ ────────────────────────────────> │ + OpenAI          │
└─────────────────┘                                   │ + Supabase (RAG)  │
                                                      │ + WeatherAPI      │
                                                      └───────────────────┘
```

-   **Frontend**: Draait op Vercel (of lokaal), verzorgt de chat UI en bestandsuploads.
-   **Backend**: Draait op Render (of lokaal), handelt de logica af (documentverwerking, RAG, chat, weer-check) via LangGraph.
-   **Supabase**: Externe dienst voor vectoropslag.
-   **OpenAI/WeatherAPI**: Externe API's voor AI en weerdata.

## Vereisten

*   Node.js v18+ en npm
*   Supabase Project (voor `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY`)
*   OpenAI API Key (`OPENAI_API_KEY`)
*   WeatherAPI Key (`WEATHER_API_KEY`)
*   LangSmith API Key (`LANGSMITH_API_KEY`, vereist voor backend deployment op Render, ook al gebruik je tracing niet actief)
*   Docker Desktop (voor het lokaal bouwen van de backend image voor Render)
*   Docker Hub Account (om de backend image te pushen)

## Installatie

1.  **Clone de repository:**
    ```bash
    git clone https://github.com/JoshuaLevi/prg08-taalmodel-2025.git
    cd prg08-taalmodel-2025
    ```
2.  **Installeer dependencies:**
    ```bash
    npm install # Installeert voor zowel frontend als backend
    ```
3.  **Configureer Omgevingsvariabelen:** Maak `.env` bestanden aan in `frontend/` en `backend/` (zie voorbeelden in `.env.example`) en vul je API keys en Supabase credentials in.

## Lokaal Draaien

Start de backend en frontend afzonderlijk:

*   **Backend:**
    ```bash
    cd backend
    npm run langgraph:dev
    ```
*   **Frontend:**
    ```bash
    cd frontend
    npm run dev
    ```
    Open daarna http://localhost:3000 in je browser.

## Gebruik

1.  Open de webinterface.
2.  Upload een PDF via de paperclip-knop.
3.  Stel je fitness-gerelateerde vragen in de chat! Vraag bijvoorbeeld naar het weer als je buiten wilt trainen.

## Deployment

Dit project is online gedeployed:

*   **Backend:** De LangGraph API draait als een Web Service op **Render**.
    *   De Docker image is lokaal gebouwd (voor `linux/amd64` platform) met `npx @langchain/langgraph-cli dockerfile Dockerfile` gevolgd door `docker build`.
    *   De image is gepusht naar Docker Hub.
    *   Render is geconfigureerd om deze "Existing Image" van Docker Hub te gebruiken.
    *   Render vereist een PostgreSQL database en een Key Value (Redis) store voor LangGraph state management. De interne connectie URLs hiervan, samen met alle API keys (`OPENAI_API_KEY`, `WEATHER_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LANGSMITH_API_KEY`), zijn ingesteld als environment variables in Render.
*   **Frontend:** De Next.js applicatie is gedeployed op **Vercel**.
    *   De `NEXT_PUBLIC_LANGGRAPH_API_URL` environment variable in Vercel wijst naar de `.onrender.com` URL van de backend service.

## Beoordeling Volgens Criteria (PRG08 Opdracht 2: Taalmodel)

Hieronder volgt een overzicht van hoe dit HyroCoach project voldoet aan de beoordelingscriteria voor de opdracht, per leerdoel:

**Leerdoel: AI tools integreren in een professioneel ingerichte javascript applicatie.**

*   **Beginner (Voldaan):**
    *   *Client/Server onderdeel:* Project is opgesplitst in `frontend/` en `backend/` mappen. (✅)
    *   *Project op GitHub met README:* Repository `JoshuaLevi/prg08-taalmodel-2025` bevat deze `README.md`. (✅)
    *   *README bevat installatie/issues:* Deze README bevat installatie-, configuratie- en deploymentinstructies. (✅)
    *   *API keys afgeschermd (.env):* Zowel frontend als backend gebruiken `.env` bestanden voor API keys en credentials. (✅)
    *   *Server communiceert met OpenAI:* De backend gebruikt `@langchain/openai` om calls te maken naar de OpenAI API. (✅, zie `backend/src/shared/utils.ts`)
*   **Op Niveau (Voldaan):**
    *   *Client toont resultaten (UI):* De React frontend (`frontend/app/page.tsx`) toont de chatberichten en antwoorden van de AI. (✅)
    *   *Gebruiksvriendelijke/duidelijke interface:* De UI is een standaard chatinterface die functioneel en gestyled is met Shadcn UI. (✅)
    *   *Gebruikersinvoer voor prompt:* Het tekstveld in de chatinterface dient als invoer voor de prompts naar de backend. (✅)
    *   *Geen calls voor vorig resultaat:* De frontend wacht op het volledige (gestreamde) antwoord van een request voordat een nieuwe gestart kan worden. (✅)
*   **Expert (Voldaan):**
    *   *Project live online:* De frontend is gedeployed op Vercel en de backend op Render. (✅, zie [Deployment](#deployment) sectie)

**Leerdoel: Werken met taalmodellen en de bijbehorende API's in javascript.**

*   **Beginner (Voldaan):**
    *   *Server call naar (Azure) OpenAI API:* De backend maakt calls naar de OpenAI API (niet Azure specifiek). (✅, zie `backend/src/shared/utils.ts`)
    *   *Uitleggen code/ChatLLM:* Dit wordt behandeld in de video-uitleg.
*   **Op Niveau (Voldaan):**
    *   *Uitleggen/toepassen Prompt Engineering:* Prompts zijn specifiek ontworpen voor de fitness coach persona en de RAG/routing logica. (✅, zie `backend/src/retrieval_graph/prompts.ts`)
    *   *Chat History (met roles) op server:* LangGraph beheert de state, inclusief de `messages` (met `HumanMessage`, `AIMessage`, `ToolMessage`), en slaat deze op in de geconfigureerde Postgres database en Redis op Render. (✅, zie `backend/src/retrieval_graph/state.js` en de configuratie op Render)
    *   *LLM weet waar het gesprek over gaat:* De berichtengeschiedenis (`state.messages`) wordt meegestuurd in de prompts naar het LLM. (✅, zie `backend/src/retrieval_graph/graph.ts` in `generateResponse` en `answerQueryDirectly`)
*   **Expert (Voldaan):**
    *   *Applicatie werkt met streaming:* Zowel de backend (via LangGraph's streaming support en SSE) als de frontend (verwerken van de stream in `frontend/app/page.tsx`) ondersteunen streaming van antwoorden. (✅)

**Leerdoel: Een taalmodel gebruiken om vragen over mijn eigen documenten te beantwoorden.**

*   **Beginner (Voldaan):**
    *   *Uitleggen nut RAG:* Dit wordt behandeld in de video-uitleg.
*   **Op Niveau (Voldaan):**
    *   *Embeddings gemaakt van eigen document:* Bij het uploaden van een PDF wordt de `ingestion_graph` aangeroepen die de tekst split en embeddings genereert via OpenAI. (✅, zie `backend/src/ingestion_graph/graph.ts`)
    *   *Embeddings opgeslagen in database:* De gegenereerde embeddings worden opgeslagen in de geconfigureerde Supabase vector database. (✅, zie `backend/src/shared/vectorstore.ts`)
    *   *Vragen stellen over eigen document:* De `retrieval_graph` bepaalt of retrieval nodig is, haalt relevante document chunks op uit Supabase, en gebruikt deze als context voor het beantwoorden van de vraag. (✅, zie `backend/src/retrieval_graph/graph.ts` nodes `retrieveDocuments` en `generateResponse`)
*   **Expert (Voldaan):**
    *   *Werkt met grotere bestanden (min. 15 pagina's):* De architectuur (tekst splitting, vector store) is ontworpen om met grotere documenten om te gaan. Getest met documenten tot 50 pagina's. (✅)

**Leerdoel: Op conceptueel niveau nadenken over AI toepassingen. Ik kan zelfstandig onderzoek doen naar documentatie.**

*   **Beginner (Voldaan):**
    *   *Uitleg categorie/doelgroep/toegevoegde waarde:* Concept (Fitness Coach voor gepersonaliseerd advies) is beschreven in deze README en geïmplementeerd in de applicatie/prompts. (✅)
*   **Op Niveau (Voldaan):**
    *   *Toegang tot live data (internet):* De WeatherAPI tool is geïmplementeerd en geïntegreerd in de LangGraph om actuele weersinformatie te bieden. (✅, zie `backend/src/retrieval_graph/tools.ts` en `backend/src/retrieval_graph/graph.ts`)
*   **Expert (Voldaan):**
    *   *Je hebt het taalmodel geïntegreerd in een React applicatie:* De frontend is een React (Next.js) applicatie die direct communiceert met de backend taalmodel-API. (✅)



