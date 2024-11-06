import { createResource } from '@/lib/actions/resources'
import { openai } from '@ai-sdk/openai'
import { convertToCoreMessages, streamText, tool } from 'ai'
import { z } from 'zod'
import { findSimilarContent } from '@/lib/ai/embedding'

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    // Validate request body
    const body = await req.json()
    if (!body?.messages || !Array.isArray(body.messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400 }
      )
    }

    const result = await streamText({
      model: openai('gpt-4'),
      messages: convertToCoreMessages(body.messages),
      system: `You are a helpful assistant. Check your knowledge base before answering any questions.
      Only respond to questions using information from tool calls.
      if no relevant information is found in the tool calls, respond, "Sorry, I don't know."`,
      tools: {
        addResource: tool({
          description: `add a resource to your knowledge base.
            If the user provides a random piece of knowledge unprompted, use this tool without asking for confirmation.`,
          parameters: z.object({
            content: z
              .string()
              .describe('the content or resource to add to the knowledge base')
          }),
        execute: async ({ content }) => {
          try {
            return await createResource({ content })
          } catch (err) {
            const error = err as Error
            console.error('Error adding resource:', error)
            return 'Failed to add resource to knowledge base'
          }
        }
      }),
        getInformation: tool({
          description: `get information from your knowledge base to answer questions.`,
          parameters: z.object({
            question: z.string().describe('the users question')
          }),
          execute: async ({ question }) => {
            try {
              const results = await findSimilarContent(question)
              if (!results?.length) {
                return 'No relevant information found'
              }
              return results
            } catch (err) {
              const error = err as Error
              console.error('Error getting information:', error)
              return 'Failed to retrieve information from knowledge base'
            }
          }
        })
      }
    })

    return result.toDataStreamResponse()
  } catch (err) {
    const error = err as Error
    console.error('Chat endpoint error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }),
      { status: 500 }
    )
  }
}