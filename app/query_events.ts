import { ethers, JsonRpcProvider } from "ethers"; // Importing modules from 'ethers' package. Similar to Java import statements but using ES6 module syntax.
import * as zlib from "zlib"; // Importing Node.js zlib module for compression/decompression.


// Moonchain RPC endpoint
const moonchainRpcUrl = "https://geneva-rpc.moonchain.com";
const provider = new JsonRpcProvider(moonchainRpcUrl);

// Smart Contract address
const contractAddress = "0x457c1542a68550ab147aE2b183B31ed54e081560";

// ABI for the Claimed event
const abi = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": true, "internalType": "address", "name": "token", "type": "address" },
            { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
            { "indexed": false, "internalType": "string", "name": "uid", "type": "string" },
            { "indexed": false, "internalType": "string", "name": "sncode", "type": "string" },
            { "indexed": false, "internalType": "address", "name": "to", "type": "address" },
            {
                "components": [
                    { "internalType": "address", "name": "token", "type": "address" },
                    { "internalType": "uint256", "name": "amount", "type": "uint256" }
                ],
                "indexed": false,
                "internalType": "struct DoitRingDevice.Reward[]",
                "name": "rewards",
                "type": "tuple[]"
            },
            { "indexed": false, "internalType": "string", "name": "memo", "type": "string" },
            { "indexed": false, "internalType": "int256", "name": "blockHeight", "type": "int256" },
            { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
        ],
        "name": "Claimed",
        "type": "event"
    }
];

// Contract instance for decoding
const contract = new ethers.Contract(contractAddress, abi, provider);

// Function to decompress Brotli data
function decompressBrotli(content: string): string { // TypeScript uses explicit typing (`string`), unlike Java where types are inferred or declared.
    try {
        const compressedBuffer = Buffer.from(content, 'base64'); // Buffer is a Node.js class for working with binary data.
        const decompressedBuffer = zlib.brotliDecompressSync(compressedBuffer); // Synchronously decompress the data using Brotli.
        return decompressedBuffer.toString('utf-8'); // Convert the binary buffer to a UTF-8 string.
    } catch (error) {
        console.error("Error decompressing Brotli data:", error); // `console.error` is similar to `System.err.println()` in Java.
        return "Decompression failed"; // Fallback string if decompression fails.
    }
}

// Function to track Claimed events
export async function trackClaimedEvents(fromBlock: number, toBlock: number): Promise<Array<{ tokenId: string, content: string, timestamp: string }>> {
    // `export` allows this function to be imported elsewhere, similar to public classes in Java.
    // `async` declares an asynchronous function (like `CompletableFuture` in Java), and `Promise` is similar to `Future` in Java.
    const filter = {
        address: contractAddress,
        fromBlock: ethers.toBeHex(fromBlock), // Converts block number to hexadecimal.
        toBlock: toBlock ? ethers.toBeHex(toBlock) : 'latest', // Similar to Java’s ternary operator.
    };

    const logs = await provider.getLogs(filter); // Await pauses the execution until the promise is resolved (like `get()` in Java's `Future`).
    console.log(`Found ${logs.length} logs`); // String interpolation with `${}` replaces Java's `String.format()`.

    const transactions: Array<{ tokenId: string, content: string, timestamp: string }> = []; // Declaring an array of objects, with each object having `tokenId`, `content`, and `timestamp` as fields.

    logs.forEach((log, index) => { // `forEach` is a higher-order function to loop over arrays. Similar to enhanced `for` loop in Java.
        try {
            const parsedLog = contract.interface.parseLog(log); // Parsing the log.
            if (!parsedLog) {
                throw new Error('parsedLog is null.'); // Explicit error throwing, similar to Java's `throw`.
            }

            const tokenId = parsedLog.args[1].toString();  // Convert tokenId to string.
            const memo = parsedLog.args[6]; // Memo field from parsed log.
            const timestamp = parsedLog.args[8].toString();  // Convert timestamp to string.

            // Parse the memo JSON
            let parsedMemo;
            try {
                parsedMemo = JSON.parse(memo); // JSON parsing, similar to Java's `JSONObject`.
            } catch (e) {
                console.log(`Error parsing memo: ${memo}`, e); // Logging any JSON parse error.
                return;
            }

            const compressedContent = parsedMemo.data?.[0]?.content || "No content"; // Optional chaining (`?.`) avoids null checks. Equivalent to multiple `if` checks in Java.
            const decompressedContent = decompressBrotli(compressedContent); // Decompressing Brotli data.

            transactions.push({ // Adding the transaction data to the array.
                tokenId: tokenId,
                content: decompressedContent,
                timestamp: timestamp
            });

            console.log(`Log ${index + 1}: tokenId=${tokenId}, content=${decompressedContent}, timestamp=${timestamp}`); // Logging data.
        } catch (error) {
            console.log(`Error decoding log ${index + 1}`, error); // Handling errors and logging.
        }
    });

    return transactions; // Returning the array of transactions.
}
