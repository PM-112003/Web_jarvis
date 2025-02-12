document.getElementById("start").addEventListener("click", () => {
    const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.start();

    recognition.onresult = (event) => {
        let text = event.results[0][0].transcript;
        document.getElementById("inputText").innerText = text;
        
        // Send text to background script for processing
        chrome.runtime.sendMessage({ action: "processText", text: text });
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
    };
});
  
// Listen for AI response
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "displayOutput") {
        document.getElementById("outputText").innerText = message.text;
    }
});
