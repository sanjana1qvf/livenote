// Merge lecture endpoint for combining multiple audio chunks
app.post('/api/merge-lecture', requireAuth, async (req, res) => {
  try {
    const { title, chunks, mergedTranscription } = req.body;
    
    if (!title || !chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const lectureId = uuidv4();
    console.log(`Merging ${chunks.length} chunks into lecture: ${lectureId}`);

    // Combine all transcriptions
    const fullTranscription = chunks
      .map(chunk => chunk.transcription)
      .join('\n\n');

    // Combine all filtered content
    const fullFilteredContent = chunks
      .map(chunk => chunk.filtered_content)
      .join('\n\n');

    // Generate summary using merged content
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert at creating concise, informative summaries of academic lectures. Create a professional summary that captures the main educational topics, key academic concepts, theories, and important learning objectives. Focus on what students need to understand and remember for their studies."
        },
        {
          role: "user",
          content: `Please create a comprehensive academic summary of this merged lecture content:\n\n${fullFilteredContent}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.3
    });

    // Generate structured academic notes using merged content
    const notesResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert academic note-taker specializing in creating study-ready notes for students. Create clear, well-organized academic notes using simple text formatting. Use dashes (-) for lists, plain text for section titles, simple line breaks for organization, and standard punctuation. No markdown formatting whatsoever. Focus on key academic concepts, definitions, theories, formulas, examples, and important details that students need for studying and exams. Structure the notes logically with main topics, subtopics, and supporting details."
        },
        {
          role: "user",
          content: `Please create detailed, well-structured academic notes from this merged lecture content:\n\n${fullFilteredContent}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    // Generate Q&A using merged content
    const qaResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert educator who creates comprehensive study questions and answers from academic content. Generate important questions that test understanding of key concepts, definitions, theories, and practical applications. Format each Q&A as 'Q: [question]' followed by 'A: [detailed answer]' on the next line. Create questions that would help students prepare for exams, covering main topics, important details, and critical thinking aspects. Include different types of questions: factual, conceptual, analytical, and application-based. Make answers detailed and educational."
        },
        {
          role: "user",
          content: `Please create comprehensive study questions and answers from this merged lecture content. Generate 8-12 important questions that cover the main topics and key concepts:\n\n${fullFilteredContent}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    const summary = summaryResponse.choices[0].message.content;
    const notes = notesResponse.choices[0].message.content;
    const qna = qaResponse.choices[0].message.content;

    console.log('Merged lecture processing completed');

    // Save merged lecture to database
    const mergedLecture = {
      id: lectureId,
      user_id: req.user.id,
      title: title,
      transcription: fullTranscription,
      filtered_content: fullFilteredContent,
      summary,
      notes,
      qna,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.createLecture(mergedLecture);
    console.log('Merged lecture saved to database successfully');

    res.json(mergedLecture);
  } catch (error) {
    console.error('Error merging lecture:', error);
    
    let errorMessage = 'Failed to merge lecture';
    if (error.message.includes('timeout')) {
      errorMessage = 'Lecture merging timed out. Please try again.';
    } else if (error.message.includes('API key')) {
      errorMessage = 'API configuration error. Please contact support.';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});
