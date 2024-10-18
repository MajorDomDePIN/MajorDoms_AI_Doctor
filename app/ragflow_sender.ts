import axios from 'axios'; // Importing the `axios` library to make HTTP requests.

// Defining constants for the Ragflow API URL, user ID, and API token.
const gRagApiUrl = "http://demo.ragflow.io/v1/api/";
const gRagUserId = "YourUserIdHere"; // The user ID used for API requests.
const gRagApiToken = "ragflow-Q1N2EwYzdlODdkODExZWZhOTAxNDIwMT"; // API token for authentication with Ragflow.

// Function to send data to Ragflow
export async function sendToRagflow(tokenId: string, data: string) {
    // Create a detailed question with structured data         Sleep analysis: ${JSON.stringify(data.sleep)}.
    const question = `You are a professional health advisor. I am the owner of token ID ${tokenId}.\n`
        + `Based on the following health data from the past week, please provide personalized suggestions.\n`
        + `Health Data start.\n${data}\nHealth Data stop. `;
    // Logging the constructed question for debugging purposes.
    console.log(`Q: ${question}`);

    try {
        // Create a new conversation
        // Define the URL for creating a new conversation in Ragflow, with the user ID included in the query string.
        const url_new = `${gRagApiUrl}/new_conversation?user_id=${gRagUserId}`;
        // Creating the headers for the request, including the API token for authorization.
        const headers = { Authorization: `Bearer ${gRagApiToken}` };

        // Sending a GET request to create a new conversation and awaiting the response.
        const newConversationResponse = await axios.get(url_new, { headers });

        // Extracting the conversation ID from the response.
        const conversationId = newConversationResponse.data?.data?.id;

        // If no conversation ID is returned, log an error and exit the function.
        if (!conversationId) {
            console.error("Failed to create a new conversation:", newConversationResponse.data);
            return; // Exit the function if conversation creation fails.
        }


        // Define the URL for posting the message (health data) to the conversation.
        const url_completion = `${gRagApiUrl}/completion`;
        // Creating the data object to send with the POST request, including the conversation ID, message, and settings for the conversation.
        const postData = {
            conversation_id: conversationId, // ID of the conversation created earlier.
            messages: [
                {
                    role: 'user', // Role specifies that the message is coming from the user.
                    content: question // The health data question constructed earlier is sent here.
                }
            ],
            quote: false, // Optional field to disable quoting (used for more advanced conversations).
            stream: false // Disables streaming of the response.
        };

        // Sending a POST request to Ragflow with the health data and awaiting the response.
        const completionResponse = await axios.post(url_completion, postData, { headers });

        // Checking the response code to see if there was an error.
        if (completionResponse.data.retcode !== 0) {
            // If there is an error, log it.
            console.error("Error from Ragflow:", completionResponse.data.retmsg);
        } else {
            // Extract the answer from the response and log it.
            //console.log(completionResponse)
            const answer = completionResponse.data?.data?.answer;
            console.log("Ragflow Response:", answer);
        }
    } catch (error) {
        // Catch any errors that occur during the API request and log them.
        console.error("Error sending to Ragflow:", error);
    }
}
