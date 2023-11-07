//DO NOT EDIT LlAMA2 Version 11/5/23
//CMD C:\Projects\DID\streams_Oct>node app.js on http://localhost:3000/

'use strict';
import DID_API from './api.json' assert { type: 'json' };

if (DID_API.key == '🤫') alert('Please put your API key inside ./api.json and restart.');


async function fetchAIResponse(userMessage, history = []) {
  const localServerEndpoint = 'http://127.0.0.1:8080';

  // Define the system prompt
  const systemPrompt = "Limite your responses to 400 wrds or fewer.  You are a no nonsense assistant who \
  specializes in Amazon Web Services and you respond in a professional narrative chat format in a concise \
  manner with complete sentences and your response by asking if there is anything else you can assit with";

  // Add [INST] tags around user message
  const taggedUserMessage = `[INST] ${userMessage} [/INST]`;

  // Flatten the history and concatenate with the new tagged message
  const flattenedHistory = history.flat();
  const fullMessage = [systemPrompt, ...flattenedHistory, taggedUserMessage].join('\n');


  const requestBody = {
    "inputs": fullMessage,
    "parameters": {
      "best_of": 1,
      "details": true,
      "do_sample": true,
      "max_new_tokens": 512,
      "repetition_penalty": 1.03,
      "return_full_text": false,
      "temperature": 0.01,
      "top_k": 10,
      "top_n_tokens": 5,
      "top_p": 0.95,
      "truncate": null,
    },
    "stream": false
  };
 
    const response = await fetchWithRetries(localServerEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  
    if (!response.ok) {
      throw new Error(`Local server request failed with status ${response.status}`);
    }
    const data = await response.json();

    // Print the full parsed response to the console
    console.log("Full Parsed Response:", data);

    // Since data is an array, we need to access the first element and then get the generated_text
    if (data && Array.isArray(data) && data.length > 0) {
      let generatedText = data[0].generated_text;
      console.log("Generated Text:", generatedText);
      return data; // This will return the data to the caller.
  } else {
      console.error("Invalid API Response");
      return null;
  }
}

const RTCPeerConnection = (
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection
).bind(window);

let peerConnection;
let streamId;
let sessionId;
let sessionClientAnswer;

let statsIntervalId;
let videoIsPlaying;
let lastBytesReceived;

const talkVideo = document.getElementById('talk-video');
talkVideo.setAttribute('playsinline', '');
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');
const streamingStatusLabel = document.getElementById('streaming-status-label');

const connectButton = document.getElementById('connect-button');
connectButton.onclick = async () => {
  if (peerConnection && peerConnection.connectionState === 'connected') {
    return;
  }

  stopAllStreams();
  closePC();

  const sessionResponse = await fetch(`${DID_API.url}/talks/streams`, {
    method: 'POST',
    headers: {'Authorization': `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      source_url: "https://raw.githubusercontent.com/jjmlovesgit/D-id_Streaming_Chatgpt/main/compguy512.png",
    }),
  });

  const { id: newStreamId, offer, ice_servers: iceServers, session_id: newSessionId } = await sessionResponse.json()
  streamId = newStreamId;
  sessionId = newSessionId;
  
  try {
    sessionClientAnswer = await createPeerConnection(offer, iceServers);
  } catch (e) {
    console.log('error during streaming setup', e);
    stopAllStreams();
    closePC();
    return;
  }

  const sdpResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}/sdp`,
    {
      method: 'POST',
      headers: {Authorization: `Basic ${DID_API.key}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({answer: sessionClientAnswer, session_id: sessionId})
    });
};

// This section is modified to accept the local response as text input to D-ID #139
const talkButton = document.getElementById('talk-button');

talkButton.onclick = async () => {
    if (peerConnection?.signalingState === 'stable' || peerConnection?.iceConnectionState === 'connected') {
        // Get the user input from the text input field
        const userInput = document.getElementById('user-input-field').value;

        // Fetch response from local llm
        const responseFromAI = await fetchAIResponse(userInput);

        // Print the llm response to the console - Troubleshooting
        // console.log("AI Response:", responseFromAI);

        // Extract generated_text from the response
        let generatedText = responseFromAI[0]?.generated_text;
        // console.log("Extracted generatedText:", generatedText);

        // Check if generatedText was successfully extracted
        if (!generatedText) {
            console.error("Could not extract generated_text from the response");
            return;  // Exit function if we can't extract the text
        }

        // Check if the checkbox is checked
        const isSendToDID = document.getElementById('toggleDID').checked;

        if (isSendToDID) {
            // Make a POST request to the DID_API using the extracted generatedText
            const talkResponse = await fetch(`${DID_API.url}/talks/streams/${streamId}`, {
                method: 'POST',
                headers: { 
                    Authorization: `Basic ${DID_API.key}`, 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    script: {
                        type: 'text',
                        subtitles: 'false',
                        provider: { type: 'microsoft', voice_id: 'en-US-ChristopherNeural' },
                        ssml: false,
                        input: generatedText  // Send the extracted text to D-id
                    },
                    config: {
                        fluent: true,
                        pad_audio: 0,
                        driver_expressions: {
                            expressions: [{ expression: 'neutral', start_frame: 0, intensity: 0 }],
                            transition_frames: 0
                        },
                        align_driver: true,
                        align_expand_factor: 0,
                        auto_match: true,
                        motion_factor: 0,
                        normalization_factor: 0,
                        sharpen: true,
                        stitch: true,
                        result_format: 'mp4'
                    },
                    'driver_url': 'bank://lively/',
                    'config': {
                        'stitch': true,
                    },
                    'session_id': sessionId
                })
            });
        } else {
            // Just print the response to the console
            // console.log("Generated Text (Console Only):", generatedText);
        }
    }
};

// NOTHING BELOW THIS LINE IS CHANGED FROM THE ORIGINAL D-id File Example

const destroyButton = document.getElementById('destroy-button');
destroyButton.onclick = async () => {
  await fetch(`${DID_API.url}/talks/streams/${streamId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Basic ${DID_API.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: sessionId }),
  });

  stopAllStreams();
  closePC();
};

function onIceGatheringStateChange() {
  iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
  iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
}
function onIceCandidate(event) {
  console.log('onIceCandidate', event);
  if (event.candidate) {
    const { candidate, sdpMid, sdpMLineIndex } = event.candidate;

    fetch(`${DID_API.url}/talks/streams/${streamId}/ice`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate,
        sdpMid,
        sdpMLineIndex,
        session_id: sessionId,
      }),
    });
  }
}
function onIceConnectionStateChange() {
  iceStatusLabel.innerText = peerConnection.iceConnectionState;
  iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
  if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed') {
    stopAllStreams();
    closePC();
  }
}
function onConnectionStateChange() {
  // not supported in firefox
  peerStatusLabel.innerText = peerConnection.connectionState;
  peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
}
function onSignalingStateChange() {
  signalingStatusLabel.innerText = peerConnection.signalingState;
  signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
}

function onVideoStatusChange(videoIsPlaying, stream) {
  let status;
  if (videoIsPlaying) {
    status = 'streaming';
    const remoteStream = stream;
    setVideoElement(remoteStream);
  } else {
    status = 'empty';
    playIdleVideo();
  }
  streamingStatusLabel.innerText = status;
  streamingStatusLabel.className = 'streamingState-' + status;
}

function onTrack(event) {
  /**
   * The following code is designed to provide information about wether currently there is data
   * that's being streamed - It does so by periodically looking for changes in total stream data size
   *
   * This information in our case is used in order to show idle video while no talk is streaming.
   * To create this idle video use the POST https://api.d-id.com/talks endpoint with a silent audio file or a text script with only ssml breaks 
   * https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html#break-tag
   * for seamless results use `config.fluent: true` and provide the same configuration as the streaming video
   */

  if (!event.track) return;

  statsIntervalId = setInterval(async () => {
    const stats = await peerConnection.getStats(event.track);
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        const videoStatusChanged = videoIsPlaying !== report.bytesReceived > lastBytesReceived;

        if (videoStatusChanged) {
          videoIsPlaying = report.bytesReceived > lastBytesReceived;
          onVideoStatusChange(videoIsPlaying, event.streams[0]);
        }
        lastBytesReceived = report.bytesReceived;
      }
    });
  }, 500);
}

async function createPeerConnection(offer, iceServers) {
  if (!peerConnection) {
    peerConnection = new RTCPeerConnection({ iceServers });
    peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
    peerConnection.addEventListener('icecandidate', onIceCandidate, true);
    peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
    peerConnection.addEventListener('connectionstatechange', onConnectionStateChange, true);
    peerConnection.addEventListener('signalingstatechange', onSignalingStateChange, true);
    peerConnection.addEventListener('track', onTrack, true);
  }

  await peerConnection.setRemoteDescription(offer);
  console.log('set remote sdp OK');

  const sessionClientAnswer = await peerConnection.createAnswer();
  console.log('create local sdp OK');

  await peerConnection.setLocalDescription(sessionClientAnswer);
  console.log('set local sdp OK');

  return sessionClientAnswer;
}

function setVideoElement(stream) {
  if (!stream) return;
  talkVideo.srcObject = stream;
  talkVideo.loop = false;

  // safari hotfix
  if (talkVideo.paused) {
    talkVideo
      .play()
      .then((_) => {})
      .catch((e) => {});
  }
}

function playIdleVideo() {
  talkVideo.srcObject = undefined;
  talkVideo.src = '5loop.mp4';
  talkVideo.loop = true;
}

function stopAllStreams() {
  if (talkVideo.srcObject) {
    console.log('stopping video streams');
    talkVideo.srcObject.getTracks().forEach((track) => track.stop());
    talkVideo.srcObject = null;
  }
}

function closePC(pc = peerConnection) {
  if (!pc) return;
  console.log('stopping peer connection');
  pc.close();
  pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange, true);
  pc.removeEventListener('icecandidate', onIceCandidate, true);
  pc.removeEventListener('iceconnectionstatechange', onIceConnectionStateChange, true);
  pc.removeEventListener('connectionstatechange', onConnectionStateChange, true);
  pc.removeEventListener('signalingstatechange', onSignalingStateChange, true);
  pc.removeEventListener('track', onTrack, true);
  clearInterval(statsIntervalId);
  iceGatheringStatusLabel.innerText = '';
  signalingStatusLabel.innerText = '';
  iceStatusLabel.innerText = '';
  peerStatusLabel.innerText = '';
  console.log('stopped peer connection');
  if (pc === peerConnection) {
    peerConnection = null;
  }
}

const maxRetryCount = 3;
const maxDelaySec = 4;
// Default of 1 moved to 3
async function fetchWithRetries(url, options, retries = 3) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries <= maxRetryCount) {
      const delay = Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) * 1000;

      await new Promise((resolve) => setTimeout(resolve, delay));

      console.log(`Request failed, retrying ${retries}/${maxRetryCount}. Error ${err}`);
      return fetchWithRetries(url, options, retries + 1);
    } else {
      throw new Error(`Max retries exceeded. error: ${err}`);
    }
  }
}