import { trackClaimedEvents } from './query_events';
// Import syntax: Java uses `import` to include classes or packages, 
// but JavaScript (TypeScript) imports modules or specific parts using this syntax.
import * as readline from 'readline';
// In JavaScript, `* as` imports all the exports from a module under one namespace. 
// In Java, you don't have such syntax.
import { sendToRagflow } from './ragflow_sender';
import { ethers, JsonRpcProvider } from "ethers";
// Multiple imports from one package are possible in JavaScript with `{}`. In Java, you'd need separate imports for each class.
import { groupings, ratings } from '@doitring/analyzkit';
// JavaScript allows importing multiple objects from a package this way. 
// Java typically requires a separate import statement for each class.

async function main() {
    // JavaScript (TypeScript) supports async functions for asynchronous operations. 
    const latestBlock = await getCurrentBlockNumber();
    // `const` declares a constant variable (like `final` in Java), 
    // and `await` pauses execution until the promise resolves. Java uses `CompletableFuture.get()` or `join()` for a similar effect.
    const fromBlock = 0;
    // `const` ensures `fromBlock` is constant. In Java, you'd use `final int fromBlock = 0;`.
    console.log(`Tracking from Block ${fromBlock} to ${latestBlock}`);
    // JavaScript uses `console.log` for output, whereas Java uses `System.out.println`. 
    // The `${}` syntax inside backticks is template literals, similar to Java’s `String.format()`.

    const transactions = await trackClaimedEvents(fromBlock, latestBlock);
    // Again, `await` ensures asynchronous behavior. In Java, async handling would require `CompletableFuture` or similar.

    // Start the input prompt
    askForTokenId(transactions);
}

// Function to ask for tokenId from the user and process data
function askForTokenId(transactions: Array<{ tokenId: string, content: string, timestamp: string }>) {
    // Function declaration in JavaScript. Java uses methods within classes.
    // The type annotation for `transactions` is specific to TypeScript. In Java, you would declare `List<SomeClass>`.
    const rl = readline.createInterface({

        input: process.stdin,
        output: process.stdout
    });
    // JavaScript provides direct access to I/O streams through `readline`. 

    rl.question("Please enter a tokenId: ", async (inputTokenId) => {
        // `async` inside a callback. Java does not support anonymous async callbacks in this way. 
        // Java would need to handle the input synchronously or with `CompletableFuture.runAsync`.

        const filteredTransactions = transactions.filter(transaction => transaction.tokenId === inputTokenId);
        // JavaScript `filter()` method is for arrays, whereas Java would use `stream().filter()`.
        if (filteredTransactions.length > 0) {
            // `length` is used in JavaScript to find array size. Java uses `.size()` for collections.
            console.log(`Found ${filteredTransactions.length} transactions for tokenId ${inputTokenId}.`);
            // Template literal again.
            // Parse content field to JSON and merge data
            const parsedTransactions = filteredTransactions.map(transaction => {
                return {
                    ...transaction,
                    content: JSON.parse(transaction.content)
                };
            });
            // The `...` is the spread operator, which copies properties. Java does not have this syntax.
            // `map()` is a JavaScript array method; Java would use `stream().map()`.
            console.log(parsedTransactions)
            // Combine the data for sleeps, steps, heartRates, and oxygens
            const sleepData = parsedTransactions.flatMap(t => t.content.sleeps || []);
            // `flatMap()` in JavaScript merges arrays of arrays into a single array. 
            // Java has `stream().flatMap()` for similar functionality.
            console.log("sleepdata: ", sleepData);
            const stepsData = parsedTransactions.flatMap(t => t.content.steps || []);
            const heartRateData = parsedTransactions.flatMap(t => t.content.heartRates || []);
            const oxygenData = parsedTransactions.flatMap(t => t.content.oxygens || []);

            // Set week start to ensure 7 days of data
            const today = new Date();
            // JavaScript’s `Date` class is used here. In Java, `LocalDateTime` or `Calendar` is typically used.
            const weekStart = new Date();
            weekStart.setDate(today.getDate() - 6); // Set to 7 days ago
            // `setDate()` is a JavaScript-specific method. In Java, you would use `LocalDate.minusDays()` for date arithmetic.
            const weekStartTimestamp = Math.floor(weekStart.getTime() / 1000);
            // JavaScript uses `getTime()` to get the timestamp in milliseconds. Java would use `Instant.now().getEpochSecond()` for a similar value in seconds.
            console.log(weekStartTimestamp);

            // Group the sleep data by week, but analyze each day individually
            const weeklyGroupedSleepData = groupings.week(weekStartTimestamp, sleepData);
            // This is a function from the imported module. JavaScript allows this kind of modular grouping easily.
            // Java would organize similar functionality through classes and static methods.

            const dailySleepGroups = groupings.daily(weeklyGroupedSleepData);
            // Again, a module function call. Java would likely encapsulate this in a service class.

            // Analyze sleep data for each day in the week
            // Similar to earlier, `map()` here is iterating and transforming elements in the array.
            const dailySleepAnalysis = dailySleepGroups.map(dayGroup => ratings.sleeps(dayGroup.data));

            // Prepare a report string with separate daily sleep data
            let health_data = '';
            // `let` declares a block-scoped variable, similar to `String` in Java.
            dailySleepAnalysis.forEach((analysis, index) => {
                // `forEach()` is like a stream for-each in Java. 
                // It applies the function to each element, just like `stream().forEach()` in Java.

                health_data += `Day ${index + 1} Sleep Analysis:\n`;
                // `+=` appends to the string. In Java, you would use `StringBuilder` for efficiency with multiple concatenations.
                health_data += `- Deep Sleep: ${analysis.durations.dep / 3600} hours\n`;
                // Arithmetic and string interpolation, similar to Java’s `String.format()`.
                health_data += `- Light Sleep: ${analysis.durations.lig / 3600} hours\n`;
                health_data += `- REM Sleep: ${analysis.durations.rem / 3600} hours\n`;
                health_data += `- Sleep Score: ${analysis.score}\n`;
                health_data += `\n`;  // Separate each day's analysis with a newline
            });

            // Group the other data by week (unchanged)
            const weeklyGroupedStepsData = groupings.week(weekStartTimestamp, stepsData);
            const stepsAnalysis = ratings.steps(weeklyGroupedStepsData, 10000);  // Example target: 10,000 steps

            const weeklyGroupedHeartRateData = groupings.week(weekStartTimestamp, heartRateData);
            const heartRateAnalysis = ratings.rates(weeklyGroupedHeartRateData);

            const weeklyGroupedOxygenData = groupings.week(weekStartTimestamp, oxygenData);
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
            // Simple console output, similar to `System.out.println` in Java.
            // Send the analyzed data to Ragflow
            await sendToRagflow(inputTokenId, health_data);
            // `await` allows asynchronous execution, whereas Java would handle this with `CompletableFuture`.
        } else {
            console.log(`tokenId ${inputTokenId} was not found.`);
        }
        rl.close();  // Close the current readline interface before calling it again
        // Closes the readline interface. In Java, this would be similar to closing a `Scanner` or `BufferedReader`.
        askForTokenId(transactions);  // Ask again for a tokenId
        // Recursive call to prompt the user again. In Java, recursion would be the same.
    });
}

// Helper function to get the current block number
async function getCurrentBlockNumber(): Promise<number> {
    const moonchainRpcUrl = "https://geneva-rpc.moonchain.com";
    // Declaring strings in JavaScript is similar to Java, but both `'` and `"` can be used for string literals.
    const provider = new ethers.JsonRpcProvider(moonchainRpcUrl);
    // In Java, this would be a constructor call like `new JsonRpcProvider(moonchainRpcUrl)`.
    return provider.getBlockNumber();
    // Returns a promise that resolves to the current block number. 
    // In Java, you'd have a synchronous return or use a `CompletableFuture`.
}

main().catch(console.error);
// `catch()` is used to handle any unhandled rejections in the `async` `main()` function. 
// Java uses `try-catch` blocks for exception handling.
