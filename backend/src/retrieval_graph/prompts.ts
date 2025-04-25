import { ChatPromptTemplate } from '@langchain/core/prompts';

const ROUTER_SYSTEM_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    "You are a routing assistant. Your job is to determine if a question needs document retrieval or can be answered directly.\n\nRespond with either:\n'retrieve' - if the question requires retrieving documents\n'direct' - if the question can be answered directly AND your direct answer",
  ],
  ['human', '{query}'],
]);

const RESPONSE_SYSTEM_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are a helpful AI assistant. Your primary goal is to answer the user's question based on the provided document context.
    1. First, carefully examine the 'Context from the document' section below.
    2. If the context contains information relevant to the user's question, synthesize an answer using *only* that information. Clearly indicate that the answer comes from the document context.
    3. If the context is empty OR does not contain relevant information to answer the question, state clearly that the document context doesn't provide the answer for the specific question, and then try to answer the question using your general knowledge.
    4. Keep your answers concise.

    Context from the document:
    ---
    {context}
    ---
    
    User's question:
    {question}

    Answer:`,
  ],
]);

export { ROUTER_SYSTEM_PROMPT, RESPONSE_SYSTEM_PROMPT };
