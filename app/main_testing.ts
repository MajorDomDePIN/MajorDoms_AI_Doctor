import { trackClaimedEvents } from "./query_events";

import * as readline from 'readline';

import { sendToRagflow } from "./ragflow_sender";

import { ethers, JsonRpcProvider, ripemd160 } from "ethers";

import { groupings, ratings } from '@doitring/analyzkit';

async function main() {

    const latestBlock = await getCurrentBlockNumber();

    const fromBlock = 0;

    console.log(`Tracking from Block ${fromBlock} to ${latestBlock}`);

    const transactions = await trackClaimedEvents(fromBlock, latestBlock);

    askForTokenId(transactions);
}

function askForTokenId(transacions: Array<{ tokenId: string, content: string, timestamp: string }>) {

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question("Please enter a tokenId: ", async (inputTokenId) => {
        const filteredTransactions = transacions.filter(transactions => transactions.tokenId === inputTokenId);

        if (filteredTransactions.length > 0) {
            console.log(`Found ${filteredTransactions.length} transactions for ${inputTokenId}.`);
            const parsedTransactions = filteredTransactions.map(transacions => {
                return {
                    ...transacions,
                    content: JSON.parse(transacions.content)
                };
            });
            console.log(parsedTransactions);

            const sleepData = parsedTransactions.flatMap(t => t.content.sleeps || []);
            console.log("sleepdata: ", sleepData);
            const stepsData = parsedTransactions.flatMap(t => t.content.steps || []);
            const heartRateData = parsedTransactions.flatMap(t => t.content.heartRates || []);
            const oxygenData = parsedTransactions.flatMap(t => t.content.oxygens || []);


            const today = new Date();

            const weekStart = new Date();
            weekStart.setDate(today.getDate() - 6);

            const weekStartTimestamp = Math.floor(weekStart.getTime() / 1000);

            console.log(weekStartTimestamp);
            const weeklyGroupedSleepData = groupings.week(weekStartTimestamp, sleepData);

            const dailySleepGroups = groupings.daily(weeklyGroupedSleepData);

            const dailySleepAnalysis = dailySleepGroups.map(dayGroup => ratings.sleeps(dayGroup.data))

            let health_data = '';

            dailySleepAnalysis.forEach((analysis, index) => {
                health_data += `Day ${index + 1} Sleep Analysis: \n`;
                health_data += `- Deep Sleep: ${analysis.durations.dep / 3600} hours\n`;
                // Arithmetic and string interpolation, similar to Java’s `String.format()`.
                health_data += `- Light Sleep: ${analysis.durations.lig / 3600} hours\n`;
                health_data += `- REM Sleep: ${analysis.durations.rem / 3600} hours\n`;
                health_data += `- Sleep Score: ${analysis.score}\n`;
                health_data += `\n`;  // Separate each day's analysis with a newline
            });

            const weeklyGroupedStepsData = groupings.week(weekStartTimestamp, stepsData);
            const stepsAnalysis = ratings.steps(weeklyGroupedStepsData, 10000);

            const weeklyGroupedHeartRateData = groupings.week(weekStartTimestamp, heartRateData);
            const heartRateAnalysis = ratings.rates(weeklyGroupedHeartRateData);

            const weeklyGroupedOxygenData = groupings.week(weekStartTimestamp, oxygenData);
            const oxygenAnalysis = ratings.oxygens(weeklyGroupedOxygenData);

            if (stepsAnalysis.total > 0) {
                health_data += `Walked ${stepsAnalysis.total} steps and ${stepsAnalysis.km} km. Burned ${stepsAnalysis.kcal} kcal by walking.\n`;
            }
            if (heartRateAnalysis.average > 0) {
                health_data += `Average Heartrate is ${heartRateAnalysis.average} BPM.\n`;
            }
            if (oxygenAnalysis.average > 0) {
                health_data += `Average blood oxygen level is ${oxygenAnalysis.average.toFixed(2)}%.`;
            }

            console.log("Here is the analysis data: ", health_data);

            await sendToRagflow(inputTokenId, health_data);
        } else {
            console.log(`tokenId ${inputTokenId} was not found.`)
        }
        rl.close();
        askForTokenId(transacions);
    });
}

async function getCurrentBlockNumber(): Promise<number> {
    const moonchainRpcUrl = "https://geneva-rpc.moonchain.com";

    const provider = new ethers.JsonRpcProvider(moonchainRpcUrl);

    return provider.getBlockNumber();

}

main().catch(console.error);