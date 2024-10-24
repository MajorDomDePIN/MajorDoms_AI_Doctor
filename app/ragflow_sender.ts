// ragflow_sender.ts

import axios from 'axios';

const gRagApiUrl = "http://192.168.178.23/v1/api";
const gRagUserId = "YourUserIdHere";
const gRagApiToken = "ragflow-ZhYzk3MWU4OTIwMjExZWZhYTdkMDI0Mm";

// Funktion, um Daten an Ragflow zu senden
export async function sendToRagflow(tokenId: string, data: string) {
    // Erstellen einer detaillierten Frage mit strukturierten Daten
    const question = `You are a professional health advisor. I am the owner of token ID ${tokenId}.\n`
        + `Based on the following health data from the past week, please provide personalized suggestions.\n`
        + `Health Data start.\n${data}\nHealth Data stop.`;

    console.log(`Q: ${question}`);

    try {
        // Erstellen einer neuen Konversation
        const url_new = `${gRagApiUrl}/new_conversation?user_id=${gRagUserId}`;
        const headers = { Authorization: `Bearer ${gRagApiToken}` };

        const newConversationResponse = await axios.get(url_new, { headers });
        const conversationId = newConversationResponse.data?.data?.id;

        if (!conversationId) {
            console.error("Failed to create a new conversation:", newConversationResponse.data);
            return;
        }

        // Nachricht an die Konversation senden
        const url_completion = `${gRagApiUrl}/completion`;
        const postData = {
            conversation_id: conversationId,
            messages: [
                {
                    role: 'user',
                    content: question // Senden der strukturierten Daten in der Frage
                }
            ],
            quote: false,
            // stream: false, // Nicht unterstützt
        };

        // POST-Anfrage mit responseType 'stream' senden
        const completionResponse = await axios.post(url_completion, postData, { headers, responseType: 'stream' });

        // Antwortdaten sammeln
        let bufferedData = ''; // Puffer für eingehende Daten
        let fullAnswer = '';
        let errorOccurred = false;

        // Timeout nach 60 Sekunden
        const streamTimeout = setTimeout(() => {
            console.error("Stream timeout: No data received for 60 seconds.");
            completionResponse.data.destroy(); // Verbindung schließen
            errorOccurred = true;
        }, 60000); // 60.000 Millisekunden = 60 Sekunden

        // Promise erstellen, um auf das Ende des Streams zu warten
        await new Promise<void>((resolve, reject) => {
            completionResponse.data.on('data', (chunk: Buffer) => {
                // Timeout zurücksetzen, wenn Daten empfangen werden
                clearTimeout(streamTimeout);

                // Chunk zum Puffer hinzufügen
                bufferedData += chunk.toString();

                // Zeilen aus dem Puffer extrahieren
                let lines = bufferedData.split('\n');

                // Letzte Zeile im Puffer behalten, falls sie unvollständig ist
                bufferedData = lines.pop() || '';

                // Verarbeiten der vollständigen Zeilen
                for (let line of lines) {
                    line = line.trim();
                    if (line.startsWith('data:')) {
                        // Entfernen von mehrfachen 'data:' Präfixen
                        while (line.startsWith('data:')) {
                            line = line.substring(5).trim();
                        }
                        try {
                            const jsonData = JSON.parse(line);
                            if (jsonData.retcode !== 0) {
                                console.error("Error from Ragflow:", jsonData.retmsg);
                                errorOccurred = true;
                            } else {
                                const answerPart = jsonData?.data?.answer;
                                if (answerPart) {
                                    fullAnswer = answerPart; // Aktualisieren der vollständigen Antwort
                                }
                            }
                        } catch (error) {
                            console.error("Error parsing JSON:", error);
                        }
                    }
                }
            });

            completionResponse.data.on('end', () => {
                clearTimeout(streamTimeout); // Timeout löschen

                // Verarbeiten der verbleibenden Daten im Puffer
                if (bufferedData) {
                    let line = bufferedData.trim();
                    if (line.startsWith('data:')) {
                        while (line.startsWith('data:')) {
                            line = line.substring(5).trim();
                        }
                        try {
                            const jsonData = JSON.parse(line);
                            if (jsonData.retcode !== 0) {
                                console.error("Error from Ragflow:", jsonData.retmsg);
                                errorOccurred = true;
                            } else {
                                const answerPart = jsonData?.data?.answer;
                                if (answerPart) {
                                    fullAnswer = answerPart; // Aktualisieren der vollständigen Antwort
                                }
                            }
                        } catch (error) {
                            console.error("Error parsing JSON:", error);
                        }
                    }
                }

                if (!errorOccurred) {
                    console.log("Ragflow Response:", fullAnswer);
                } else {
                    console.error("An error occurred during data reception.");
                }

                resolve();
            });

            completionResponse.data.on('error', (error: any) => {
                clearTimeout(streamTimeout); // Timeout löschen
                console.error("Error receiving data from Ragflow:", error);
                errorOccurred = true;
                reject(error);
            });
        });

    } catch (error) {
        console.error("Error sending to Ragflow:", error);
    }
}
