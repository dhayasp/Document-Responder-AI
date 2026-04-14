# 📄 Final Year Project Report: Tiger AI (Document Responder AI)

## 1. Introduction
With the exponential digital transformation occurring globally, users and organizations are overwhelmed by the massive influx of documents, ranging from research papers to extensive technical manuals. Traditional keyword-based search methodologies are inefficient for understanding deep context, leading to increased cognitive load and lost productivity. 
**Tiger AI** is cutting-edge Artificial Intelligence platform designed to bridge this gap. This application serves as an "Intelligent Document Responder," allowing users to instantaneously chat with their uploaded files to receive highly accurate, contextually bounded answers formatted specifically for educational consumption.

## 2. Problem Statement
Current document querying systems suffer from three major bottlenecks:
1. **Context Ignorance:** Standard `Ctrl+F` exact-match searches fail to understand the semantic intent of complex queries.
2. **Hallucination Risks:** Public Large Language Models (LLMs) like ChatGPT will confidently hallucinate answers when they lack proprietary internal context about a user's specific PDF or text file.
3. **Accessibility:** Tools lack modern UI workflows tailored toward student learning, primarily lacking memory preservation, audio ingestion, and study material export features.

## 3. Proposed Solution Architecture
Tiger AI utilizes an elite implementation of **RAG (Retrieval-Augmented Generation)** to construct a closed-loop truth system. 
When a user queries the platform, the query is converted into a high-dimensional mathematical vector. The system scans the database for the exact paragraphs relating to that vector within milliseconds. It then securely feeds *only* those paragraphs into a specialized LLM payload, restricting the AI model from hallucinating data outside the provided text boundaries. 

## 4. Key Features Implemented

* **🧠 Intelligent Vector RAG Search:** Proprietary document ingestion that extracts, chunks, and semantically maps uploaded text layers into Supabase `pgvector` architecture for extreme search velocity.
* **⚡ Live Interactive Streaming (SSE):** Overcomes asynchronous API latency limits by piping Server-Sent Events from the AI directly into the React DOM. Users watch the AI dynamically "type" out its answers in real-time.
* **📑 Chat Session Navigation:** A dual-pane graphical interface utilizing deterministic Session UUIDs allowing users to create separate, concurrent conversational threads without the contexts cross-pollinating. Smart-Title generation detects contexts and re-labels sidebars automatically.
* **🎓 Study Guide Generator:** Embedded `.pdf` payload export capabilities (`html2pdf.js`). Instantly clones, formats, and downloads the AI's markdown outputs into a clean A4 study-guide for exams.
* **🎙️ Voice Output & Input Navigation:** Bidirectional Accessibility. Users can leverage Web Speech API architecture to interface with the bot totally hands-free, including real-time Text-to-Speech playback. 
* **🔒 Zero-Trust Authentication:** Supabase-managed Row Level Security (RLS) restricts database interaction. All document chunks and historical chats are tightly bounded to strictly cryptographically verified JWT user tokens.

## 5. Technology Stack & Tools Used

### Frontend Architecture
* **Next.js 14+ (App Router):** Core isomorphic framework handling both the React Client components and the Serverless payload delivery.
* **React:** Stateful UI rendering, effect hooks.
* **Framer Motion:** Heavy GPU-accelerated declarative path animations for the dynamic premium landing interfaces (`Tiger AI`).
* **Phosphor Icons:** Modern iconographic library.
* **React Markdown:** Lexical string parsing to enforce "Exam-Ready" formatting (headers, ordered lists, inline code highlighting).

### Backend & AI Infrastructure
* **Supabase:** Core relational Database as a Service (DBaaS).
   * **PostgreSQL + pgvector:** Advanced math-vector extension for high-dimensional semantic clustering.
   * **Supabase Auth:** Integrated signups, Custom SMTP email verification pipelines, and JWT session handling. 
* **Xenova Transformers.js (`all-MiniLM-L6-v2`):** Serverless, lightweight Natural Language tensor embeddings generated directly on edge computing routes without relying on pricey OpenAI embedding calls.
* **DeepSeek V3 (DeepSeek API):** Primary generative knowledge inference engine mapping the user's RAG context.
* **Groq Llama 3 (Groq API):** Redundant zero-latency fallback engine that automatically catches the payload via `try/catch` if the primary AI network undergoes a timeout.

## 6. Functional Workflow (Data Pipeline)

1. **Upload:** User uploads `document.pdf`.
2. **Text Extraction:** Next.js Serverless Function parses binary PDFs securely offline into physical JS string tokens (`pdf-parse`).
3. **Chunking & Embedding:** Text is sliced into overlap boundaries and passed through Xenova pipeline to achieve vector matrices.
4. **Data Sync:** Vectors inserted into Supabase under `user_id` context.
5. **Retrieval Trigger:** User asks: "Explain Chapter 3". User prompt is vectorized. Supabase computes geometric doting bounds (`match_threshold: 0.1`) and fetches highest matching context chunks.
6. **Inference Loop:** Relevant chunks compiled and bound inside the `Tiger AI` meta-prompt. Stream response is dispatched chunk-by-chunk to the React presentation layer natively mapping history memory.

## 7. Future Enhancements Scope
While the foundational prototype of Tiger AI is finalized and production-ready, subsequent iterations intend to expand scalability via:
- Multi-Agent architectures (Delegating complex math requests to a specific code-interpreter plugin).
- Optical Character Recognition (OCR) fallback implementation for pure image-based documents.
- Real-time collaborative workspace chat environments.

## 8. Conclusion
The **Tiger AI Document Responder** successfully bridges the complex gap between semantic natural language processing limitations and proprietary data search. By tightly restricting generative AI into an advanced, mathematically-validated Retrieval Augmented Generation wrapper, users unlock extreme contextual transparency. Coupled with the heavily stylized memory persistence interfaces and physical PDF study-guide exports, the platform successfully demonstrates a highly viable ecosystem optimized directly for educational acceleration.
