import axios from 'axios';

const gRagApiUrl = "http://demo.ragflow.io/v1/api/";
const gRagUserId = "YourUserIdHere";
const gRagApiToken = "ragflow-Q1N2EwYzdlODdkODExZWZhOTAxNDIwMT";

// Function to send data to Ragflow
export async function sendToRagflow(data: { tokenId: string, content: string, timestamp: string }) {
    const question = `You are an AI analyzing health data. The data for tokenId ${data.tokenId} is "${data.content}". Please provide suggestions based on this data.`;

    try {
        // Create a new conversation
        const url_new = `${gRagApiUrl}/new_conversation?user_id=${gRagUserId}`;
        const headers = { Authorization: `Bearer ${gRagApiToken}` };

        const newConversationResponse = await axios.get(url_new, { headers });
        const conversationId = newConversationResponse.data?.data?.id;

        if (!conversationId) {
            console.error("Failed to create a new conversation:", newConversationResponse.data);
            return;
        }

        // Post the message to the conversation
        const url_completion = `${gRagApiUrl}/completion`;
        const postData = {
            conversation_id: conversationId,
            messages: [
                {
                    role: 'user',
                    content: question // Send the content as part of the "messages"
                }
            ],
            quote: false,
            stream: false
        };

        const completionResponse = await axios.post(url_completion, postData, { headers });

        // Check for errors
        if (completionResponse.data.retcode !== 0) {
            console.error("Error from Ragflow:", completionResponse.data.retmsg);
        } else {
            const answer = completionResponse.data?.data?.answer;
            console.log("Ragflow Response:", answer);
        }
    } catch (error) {
        console.error("Error sending to Ragflow:", error);
    }
}