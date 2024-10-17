import { trackClaimedEvents } from './query_events';
import * as readline from 'readline';
import { sendToRagflow } from './ragflow_sender_test';
import { ethers, JsonRpcProvider } from "ethers";
import { groupings, ratings } from '@doitring/analyzkit';

async function main() {
    const latestBlock = await getCurrentBlockNumber();
    const fromBlock = 0;
    console.log(`Tracking from Block ${fromBlock} to ${latestBlock}`);

    const transactions = await trackClaimedEvents(fromBlock, latestBlock);

    // Start the input prompt
    askForTokenId(transactions);
}

// Function to ask for tokenId from the user and process data
function askForTokenId(transactions: Array<{ tokenId: string, content: string, timestamp: string }>) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question("Please enter a tokenId: ", async (inputTokenId) => {
        const filteredTransactions = transactions.filter(transaction => transaction.tokenId === inputTokenId);

        if (filteredTransactions.length > 0) {
            console.log(`Found ${filteredTransactions.length} transactions for tokenId ${inputTokenId}.`);

            // Parse content field to JSON and merge data
            const parsedTransactions = filteredTransactions.map(transaction => {
                return {
                    ...transaction,
                    content: JSON.parse(transaction.content)
                };
            });
            // Combine the data for sleeps, steps, heartRates, and oxygens
            const sleepData = parsedTransactions.flatMap(t => t.content.sleeps || []);
            console.log("sleepdata: ", sleepData);
            const stepsData = parsedTransactions.flatMap(t => t.content.steps || []);
            const heartRateData = parsedTransactions.flatMap(t => t.content.heartRates || []);
            const oxygenData = parsedTransactions.flatMap(t => t.content.oxygens || []);

            const today = new Date();
            const yesterday = Math.floor(today.getTime() / 1000); // Current timestamp in seconds
            console.log(yesterday);

            // Group the sleep data by week, but analyze each day individually
            const weeklyGroupedSleepData = groupings.week(yesterday, sleepData);
            const dailySleepGroups = groupings.daily(weeklyGroupedSleepData);

            // Analyze sleep data for each day in the week
            const dailySleepAnalysis = dailySleepGroups.map(dayGroup => ratings.sleeps(dayGroup.data));

            // Prepare a report string with separate daily sleep data
            let health_data = '';
            dailySleepAnalysis.forEach((analysis, index) => {
                health_data += `Day ${index + 1} Sleep Analysis:\n`;
                health_data += `- Deep Sleep: ${analysis.durations.dep / 3600} hours\n`;
                health_data += `- Light Sleep: ${analysis.durations.lig / 3600} hours\n`;
                health_data += `- REM Sleep: ${analysis.durations.rem / 3600} hours\n`;
                health_data += `- Sleep Score: ${analysis.score}\n`;
                health_data += `\n`;  // Separate each day's analysis with a newline
            });

            // Group the other data by week (unchanged)
            const weeklyGroupedStepsData = groupings.week(yesterday, stepsData);
            const stepsAnalysis = ratings.steps(weeklyGroupedStepsData, 10000);  // Example target: 10,000 steps

            const weeklyGroupedHeartRateData = groupings.week(yesterday, heartRateData);
            const heartRateAnalysis = ratings.rates(weeklyGroupedHeartRateData);

            const weeklyGroupedOxygenData = groupings.week(yesterday, oxygenData);
            const oxygenAnalysis = ratings.oxygens(weeklyGroupedOxygenData);

            // Add steps, heart rate, and oxygen data to the report
            if (stepsAnalysis.total > 0) {
                health_data += `Walked ${stepsAnalysis.total} steps and ${stepsAnalysis.km} km. Burned ${stepsAnalysis.kcal} kcal by walking.\n`;
            }
            if (heartRateAnalysis.average > 0) {
                health_data += `Average Heartrate is ${heartRateAnalysis.average} BPM.\n`;
            }
            if (oxygenAnalysis.average > 0) {
                health_data += `Average blood oxygen level is ${oxygenAnalysis.average.toFixed(2)}%.`;
            }

            console.log("Here is the analysis data:", health_data);
            // Send the analyzed data to Ragflow
            await sendToRagflow(inputTokenId, health_data);
        } else {
            console.log(`tokenId ${inputTokenId} was not found.`);
        }
        rl.close();  // Close the current readline interface before calling it again
        askForTokenId(transactions);  // Ask again for a tokenId
    });
}

// Helper function to get the current block number
async function getCurrentBlockNumber(): Promise<number> {
    const moonchainRpcUrl = "https://geneva-rpc.moonchain.com";
    const provider = new ethers.JsonRpcProvider(moonchainRpcUrl);
    return provider.getBlockNumber();
}

main().catch(console.error);
