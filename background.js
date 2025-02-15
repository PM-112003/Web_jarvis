chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ apiKey: "Your gemini api key here" });
});



// Retrieve API key securely from Chrome storage
function getApiKey() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(["apiKey"], (result) => {
            if (result.apiKey) {
                resolve(result.apiKey);
            } else {
                reject("API Key not found!");
            }
        });
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "processText") {
        const text = message.text;

        getApiKey()
            .then(API_KEY => {
                fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: `You are a Chrome extension AI agent. Extract the user’s intent from their request and return a JSON object with a "command" field. 
                                If they ask to open/fetch/search a website, return: [{ "command": "open", "url": "https://example.com" }].
                                If they ask to search something, return: [{ "command": "search", "query": "search name that user asked for" }].
                                If they ask to close the tab or exit from the current tab, return: [{ "command": "close_tab" }].
                                If they ask to open chrome settings, return: [{ "command": "open_settings" }].
                                If they ask to search something inside youtube, return: [{ "command": "youtube_search", "query": "search name that user asked for"}]
                                If their request is unclear, return: [{ "command": "unknown" }].
                                Do NOT add any extra text. 
                                User request: "${text}"`
                            }]
                        }]
                    })
                })
                .then(response => response.json())
                .then(data => {
                    let aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
                    console.log("Parsed AI Response:", aiResponse);

                    const commandsArray = JSON.parse(aiResponse);
                    processAICommands(commandsArray);
                })
                .catch(error => {
                    console.error("Error:", error);
                    chrome.runtime.sendMessage({ action: "displayOutput", text: "Error fetching AI response." });
                });
            });
    }
});

// Process AI commands in order
async function processAICommands(commands) {
    for (const commandData of commands) {
        await executeCommand(commandData);
    }
}

// Execute individual commands
function executeCommand(commandData) {
    return new Promise((resolve) => {
        if (commandData.command === "open" && commandData.url) {
            chrome.tabs.create({ url: commandData.url }, (tab) => {
                waitForPageLoad(tab.id, resolve);
            });
        } 
        else if (commandData.command === "youtube_search" && commandData.query) {
            console.log("Searching on YouTube:", commandData.query);
            chrome.tabs.create({ url: `https://www.youtube.com/results?search_query=${encodeURIComponent(commandData.query)}` });
    
        }    
        else if (commandData.command === "search" && commandData.query) {
            // Perform Google search
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(commandData.query)}`;
            console.log("Searching on Google:", searchUrl);
            chrome.tabs.create({ url: searchUrl });
        }
        else if (commandData.command === "close_tab") {
            // Close the currently active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.remove(tabs[0].id, () => {
                        console.log("Closed the active tab.");
                    });
                }
            });
        }
        else if (commandData.command === "open_settings") {
            console.log("Opening Chrome Settings...");
            chrome.tabs.create({ url: "chrome://settings/" });
    
        }
        else {
            console.log("Unknown command:", commandData);
            resolve();
        }
    });
}

// Wait for a page to load before continuing
function waitForPageLoad(tabId, callback) {
    chrome.tabs.onUpdated.addListener(function listener(tabIdUpdated, changeInfo) {
        if (tabIdUpdated === tabId && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            callback();
        }
    });
}