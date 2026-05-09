# 📄 Final Year Project Report: Tiger AI (Document Responder AI)

## 1. Introduction
With the exponential digital transformation occurring globally, users and organizations are overwhelmed by the massive influx of documents, ranging from research papers to extensive technical manuals. Traditional keyword-based search methodologies are inefficient for understanding deep context, leading to increased cognitive load and lost productivity. 

**Tiger AI** is cutting-edge Artificial Intelligence platform designed to bridge this gap. This application serves as an "Intelligent Document Responder," allowing users to instantaneously chat with their uploaded files to receive highly accurate, contextually bounded answers formatted specifically for educational consumption.

## 2. Problem Statement
Current document querying systems suffer from three major bottlenecks:
1. **Context Ignorance:** Standard `Ctrl+F` exact-match searches fail to understand the semantic intent of complex queries.
2. **Hallucination Risks:** Public Large Language Models (LLMs) like ChatGPT will confidently hallucinate answers when they lack proprietary internal context about a user's specific PDF or text file.
3. **Collaboration & Accessibility:** Tools lack modern UI workflows tailored toward student learning, primarily lacking memory preservation, real-time study-group sharing, audio ingestion, and study material export features.

## 3. Proposed Solution Architecture
Tiger AI utilizes an elite implementation of **RAG (Retrieval-Augmented Generation)** to construct a closed-loop truth system. 
When a user queries the platform, the query is converted into a high-dimensional mathematical vector. The system scans the database for the exact paragraphs relating to that vector within milliseconds. It then securely feeds *only* those paragraphs into a specialized LLM payload, restricting the AI model from hallucinating data outside the provided text boundaries. 

## 4. Key Features Implemented

* **🧠 Intelligent Vector RAG Search:** Proprietary document ingestion that extracts, chunks, and semantically maps uploaded text layers into Supabase `pgvector` architecture for extreme search velocity.
* **🌍 Real-Time Collaborative Workspaces:** Users can generate unique Collaborative Rooms to study with peers. All document uploads, chat messages, and file deletions are synchronized across all active users in the room instantly via WebSockets (Supabase Realtime).
* **⚡ Live Interactive Streaming (SSE):** Overcomes asynchronous API latency limits by piping Server-Sent Events from the AI directly into the React DOM. Users watch the AI dynamically "type" out its answers in real-time.
* **📑 Context-Aware Session Isolation:** A dual-pane graphical interface utilizing deterministic Session UUIDs allowing users to create separate, concurrent conversational threads. The vector search automatically filters context so Private Room queries only retrieve Private documents, while Collab Room queries retrieve shared peer documents.
* **🎓 Study Guide Generator:** Embedded `.pdf` payload export capabilities (`html2pdf.js`). Instantly clones, formats, and downloads the AI's markdown outputs into a clean A4 study-guide for exams.
* **🎙️ Voice Output & Input Navigation:** Bidirectional Accessibility. Users can leverage Web Speech API architecture to interface with the bot totally hands-free, including real-time Text-to-Speech playback. 
* **🔒 Zero-Trust Authentication & Cascading Deletions:** Supabase-managed Row Level Security (RLS) restricts database interaction. All document chunks and historical chats are tightly bounded to strictly cryptographically verified JWT user tokens and Room Owner policies.

## 5. Technology Stack & Tools Used

### Frontend Architecture
* **Next.js 14+ (App Router):** Core isomorphic framework handling both the React Client components and the Serverless payload delivery.
* **React:** Stateful UI rendering, effect hooks.
* **Framer Motion & Vanilla CSS:** Heavy GPU-accelerated declarative path animations and premium glowing UI aesthetics.
* **Phosphor Icons:** Modern iconographic library.
* **React Markdown:** Lexical string parsing to enforce "Exam-Ready" formatting (headers, ordered lists, inline code highlighting).

### Backend & AI Infrastructure
* **Supabase:** Core relational Database as a Service (DBaaS).
   * **PostgreSQL + pgvector:** Advanced math-vector extension for high-dimensional semantic clustering.
   * **Supabase Realtime:** WebSocket-driven channel broadcasting for live peer typing indicators and document synchronization.
   * **Supabase Auth:** Integrated signups, Custom SMTP email verification pipelines, and JWT session handling. 
* **Xenova Transformers.js (`all-MiniLM-L6-v2`):** Serverless, lightweight Natural Language tensor embeddings generated directly on edge computing routes without relying on pricey OpenAI embedding calls.
* **DeepSeek V3 (DeepSeek API):** Primary generative knowledge inference engine mapping the user's RAG context.
* **Groq Llama 3 (Groq API):** Redundant zero-latency fallback engine that automatically catches the payload via `try/catch` if the primary AI network undergoes a timeout.

## 6. Functional Workflow (Data Pipeline)

1. **Upload Phase:** User uploads `document.pdf`. The Uploader passes context (`mode=private` or `mode=collab`) into the `FormData`.
2. **Text Extraction:** Next.js Serverless Function parses binary PDFs securely offline into physical JS string tokens (`pdf-parse`).
3. **Chunking & Embedding:** Text is sliced into overlap boundaries and passed through the Xenova pipeline to achieve vector matrices.
4. **Data Sync & Realtime Broadcast:** Vectors are inserted into Supabase under the specific user and room context. A WebSocket broadcast is simultaneously fired, notifying all peers in the room that a new document is now queryable.
5. **Retrieval Trigger:** User asks: "Explain Chapter 3". The query is vectorized. A custom Postgres RPC (`match_documents`) computes geometric cosine distances (`match_threshold: 0.1`) while securely filtering out documents that do not belong to the user's active Session ID.
6. **Inference Loop:** Relevant chunks compiled and bound inside the `Tiger AI` meta-prompt. Stream response is dispatched chunk-by-chunk to the React presentation layer natively mapping history memory.

## 7. Security & Row Level Isolation
A major milestone of the Tiger AI system is its multi-tenant data architecture.
- **Private Data Protection**: Private files uploaded by User A are structurally invisible to User B, even if User B is logged in on the same network.
- **Collab Room Ownership**: Room Owners retain absolute authority over their collaborative workspaces. Due to complex SQL RLS policies, only the Room Owner can physically Cascade Delete the room.
- **WebSocket Throttling**: Typing indicators and live sync events are heavily debounced via React `useRef` architecture to prevent WebSocket congestion and rate-limit drops.

## 8. Future Enhancements Scope
While the foundational prototype of Tiger AI is finalized and production-ready, subsequent iterations intend to expand scalability via:
- Multi-Agent architectures (Delegating complex math requests to a specific code-interpreter plugin).
- Optical Character Recognition (OCR) fallback implementation for pure image-based documents.
- Cloud Object Storage (S3) implementation to persist actual raw `.pdf` files rather than just their mathematical embeddings.

## 9. Conclusion
The **Tiger AI Document Responder** successfully bridges the complex gap between semantic natural language processing limitations and proprietary data search. By tightly restricting generative AI into an advanced, mathematically-validated Retrieval Augmented Generation wrapper, users unlock extreme contextual transparency. Coupled with the heavily stylized memory persistence interfaces, real-time multiplayer synchronization, and physical PDF study-guide exports, the platform successfully demonstrates a highly viable ecosystem optimized directly for modern educational acceleration.
