# Supabase Integration Notes for AI PDF Chatbot

This document outlines the steps to set up Supabase for the AI PDF Chatbot project and explains how the project interacts with Supabase.

## 1. Setting up Your Supabase Project

Follow these steps to create and configure a Supabase project suitable for this application:

1.  **Create Account:** Go to [supabase.com](https://supabase.com) and sign up for a free account (using GitHub login is convenient).
2.  **New Project:** Create a new organization (if needed) and then create a **New Project**.
    *   Give it a name (e.g., `ai-pdf-chat-project`).
    *   Generate and save the database password securely (though we'll primarily use API keys).
    *   Choose a region close to you.
    *   Select the **Free** plan.
3.  **Wait for Provisioning:** It might take a couple of minutes for the project infrastructure to be ready.
4.  **Find API Credentials:**
    *   Navigate to **Project Settings** (⚙️ gear icon in the bottom left).
    *   Go to the **API** section.
    *   Copy the **Project URL** (under 'Configuration'). You'll need this for `SUPABASE_URL`.
    *   Copy the **`service_role` Key** (under 'Project API Keys', click 'Show'). You'll need this for `SUPABASE_SERVICE_ROLE_KEY`. **Keep this key secret!**
5.  **Setup Database Schema (SQL Editor):**
    *   Go to the **SQL Editor** (<> icon).
    *   Click **"+ New query"**.
    *   Paste and **RUN** the following SQL script. This enables vector support, creates the table to store document chunks and their embeddings, and adds a function for searching:

    ```sql
    -- Enable the pgvector extension if not already enabled
    create extension if not exists vector with schema extensions;

    -- Create the table to store document chunks and embeddings
    create table documents (
      id uuid primary key default gen_random_uuid(), -- Automatically generate UUIDs
      content text,                                  -- The text content of the document chunk
      metadata jsonb,                                -- Metadata associated with the chunk (e.g., source PDF)
      embedding vector(1536)                         -- The vector embedding (1536 is standard for OpenAI's text-embedding-ada-002)
    );

    -- Create the function to perform vector similarity search
    create or replace function match_documents (
      query_embedding vector(1536), -- The embedding of the user's query
      match_count int,              -- The maximum number of similar documents to return
      filter jsonb DEFAULT '{}'     -- Optional filter for metadata
    ) returns table (
      id uuid,
      content text,
      metadata jsonb,
      similarity float              -- The similarity score (cosine similarity)
    )
    language plpgsql
    as $$
    #variable_conflict use_column
    begin
      return query
      select
        id,
        content,
        metadata,
        1 - (documents.embedding <=> query_embedding) as similarity -- Calculate cosine similarity
      from documents
      where metadata @> filter -- Apply metadata filter if provided
      order by documents.embedding <=> query_embedding -- Order by distance (closest first)
      limit match_count; -- Limit the number of results
    end;
    $$;
    ```
    *(Note: Ensure the vector dimension `1536` matches your embedding model. Check the [LangChain JS Supabase docs](https://js.langchain.com/docs/integrations/vectorstores/supabase/) for the latest script if needed.)*

## 2. Connecting the Project to Supabase

To allow the backend service to communicate with your Supabase project, you need to provide the API credentials via environment variables:

1.  **Navigate to the `backend` directory:** `cd backend`
2.  **Create `.env` file:** If it doesn't exist, copy the example file:
    ```bash
    cp .env.example .env
    ```
3.  **Edit `backend/.env`:** Open the file and find these lines:
    ```dotenv
    SUPABASE_URL=your-supabase-url-here
    SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
    ```
4.  **Paste Credentials:** Replace the placeholders with the **Project URL** and **`service_role` Key** you copied from your Supabase project settings in Step 1.
5.  **Save the file.** Make sure `.env` is listed in your `.gitignore` file (it should be by default) to prevent accidentally committing secrets.

**How the Code Uses These Variables:**

The backend code, specifically in `backend/src/shared/retrieval.ts`, reads these environment variables using `process.env.SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY`.

```typescript
// Inside backend/src/shared/retrieval.ts - function makeSupabaseRetriever

// 1. Check if variables are set
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are not defined',
  );
}

// 2. Create the official Supabase client
const supabaseClient = createClient(
  process.env.SUPABASE_URL ?? '', // Uses the URL from .env
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', // Uses the secret key from .env
);

// 3. Initialize LangChain's SupabaseVectorStore
const vectorStore = new SupabaseVectorStore(embeddings, {
  client: supabaseClient, // Pass the initialized client
  tableName: 'documents', // Must match the table created in SQL
  queryName: 'match_documents', // Must match the function created in SQL
});

// 4. Create a retriever from the vector store
return vectorStore.asRetriever(/* ... */);
```

This setup ensures that your backend can securely authenticate with your Supabase database to store and retrieve document embeddings.

## 3. How the Project Uses Supabase

Supabase serves as the **vector database** for this project. It's essential for the Retrieval-Augmented Generation (RAG) functionality, allowing the chatbot to answer questions based on the content of uploaded PDF documents.

Here's a breakdown of its role:

**A. Ingestion Phase (Storing Document Knowledge):**

*   **Trigger:** When you upload a PDF through the frontend.
*   **Process:**
    1.  **PDF Parsing:** The backend receives the PDF, extracts the raw text (using libraries like `pdf-parse`).
    2.  **Chunking:** The extracted text is divided into smaller, manageable chunks.
    3.  **Embedding:** Each text chunk is converted into a numerical vector (an embedding) using an AI model (e.g., OpenAI's `text-embedding-ada-002`). This vector represents the semantic meaning of the chunk.
    4.  **Storing in Supabase:** The LangChain `SupabaseVectorStore` (configured in `backend/src/shared/retrieval.ts`) sends these embeddings, along with the original text chunk and metadata (like the source filename), to your Supabase database. They are stored in the `documents` table you created.
*   **Relevant Code:** The logic for this is primarily orchestrated within the ingestion graph, likely initiated by `backend/src/ingestion_graph/graph.ts` which calls `retriever.addDocuments(docs)`. The `addDocuments` method handles the embedding and storage.

**B. Retrieval Phase (Finding Relevant Knowledge during Chat):**

*   **Trigger:** When you ask a question in the chat interface.
*   **Process:**
    1.  **Query Embedding:** Your question is also converted into a vector embedding using the *same* AI model.
    2.  **Similarity Search:** The backend uses the `SupabaseVectorStore`'s retriever functionality (see `retriever.invoke(state.query)` in `backend/src/retrieval_graph/graph.ts`).
    3.  **Supabase Function Call:** This triggers a call to the `match_documents` function within your Supabase database (the SQL function you created).
    4.  **Vector Comparison:** The `match_documents` function uses the `pgvector` extension to efficiently compare the embedding of your question against all the document chunk embeddings stored in the `documents` table.
    5.  **Returning Results:** Supabase returns the text and metadata of the document chunks whose embeddings are most semantically similar (closest in vector space) to your question's embedding.
    6.  **Augmenting the LLM:** These retrieved chunks provide context. They are passed along *with* your original question to the main language model (e.g., GPT-4) so it can generate an informed answer based on the content of your PDFs.
*   **Relevant Code:** The retrieval logic is orchestrated by `backend/src/retrieval_graph/graph.ts`, specifically the `retrieveDocuments` node which utilizes the `makeRetriever` function from `backend/src/shared/retrieval.ts`.

**In essence:** Supabase acts as the specialized, searchable long-term memory for the content of your documents, enabling the AI to find and use relevant information from them to answer your questions accurately. 