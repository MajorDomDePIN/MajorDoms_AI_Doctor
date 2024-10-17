import { ethers, JsonRpcProvider } from "ethers";
import * as zlib from "zlib";

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
function decompressBrotli(content: string): string {
    try {
        const compressedBuffer = Buffer.from(content, 'base64');
        const decompressedBuffer = zlib.brotliDecompressSync(compressedBuffer);
        return decompressedBuffer.toString('utf-8');
    } catch (error) {
        console.error("Error decompressing Brotli data:", error);
        return "Decompression failed";
    }
}

// Function to track Claimed events
export async function trackClaimedEvents(fromBlock: number, toBlock: number): Promise<Array<{ tokenId: string, content: string, timestamp: string }>> {
    const filter = {
        address: contractAddress,
        fromBlock: ethers.toBeHex(fromBlock),
        toBlock: toBlock ? ethers.toBeHex(toBlock) : 'latest',
    };

    const logs = await provider.getLogs(filter);
    console.log(`Found ${logs.length} logs`);

    const transactions: Array<{ tokenId: string, content: string, timestamp: string }> = [];

    logs.forEach((log, index) => {
        try {
            const parsedLog = contract.interface.parseLog(log);
            if (!parsedLog) {
                throw new Error('parsedLog is null.');
            }

            const tokenId = parsedLog.args[1].toString();  // tokenId as string
            const memo = parsedLog.args[6];
            const timestamp = parsedLog.args[8].toString();  // timestamp as string

            // Parse the memo JSON
            let parsedMemo;
            try {
                parsedMemo = JSON.parse(memo);
            } catch (e) {
                console.log(`Error parsing memo: ${memo}`, e);
                return;
            }

            const compressedContent = parsedMemo.data?.[0]?.content || "No content";
            const decompressedContent = decompressBrotli(compressedContent);

            transactions.push({
                tokenId: tokenId,
                content: decompressedContent,
                timestamp: timestamp
            });

            console.log(`Log ${index + 1}: tokenId=${tokenId}, content=${decompressedContent}, timestamp=${timestamp}`);
        } catch (error) {
            console.log(`Error decoding log ${index + 1}`, error);
        }
    });

    return transactions;
}
