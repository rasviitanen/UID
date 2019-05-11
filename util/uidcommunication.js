import UIDStore from "./uidstore.js"

class UIDCommunication {
    constructor() {
        this.ws = null;
        this.client = "test";
        this.endpoint = "test2";
        this.config = {"iceServers":[{"urls":"stun:stun.l.google.com:19302"}]};
        this.peerConnection = null;
        this.dataChannel = null;
        this.dataChannels = [];

        this.generateAndSetUniqueClientName();
    }


    subscribe(subscriber) {
        this.subscribers.push(subscriber);
    };

    currentRoom() {
        return "test-room";
    }

    // TODO  Convert to base58 for human readability
    generateAndSetUniqueClientName() {
        // http://www.ietf.org/rfc/rfc4122.txt
        var s = [];
        var hexDigits = "0123456789abcdef";
        for (var i = 0; i < 36; i++) {
            s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[14] = "4"; // bits 12-15 of the time_hi_and_version field to 0010
        s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01
        s[8] = s[13] = s[18] = s[23] = "-";

        var uuid = s.join("");
        this.client = uuid;
    }

    setClientName(name) {
        this.client = name;
    }

    setEndpoint(endpoint) {
        this.endpoint = endpoint;
    }

    shouldRespond(jsonMsg) {
        return jsonMsg.from !== this.client && ((jsonMsg.endpoint === this.client) || (jsonMsg.room === this.currentRoom()));
    }

    connectToWebsocket() {
        return new Promise((resolve, reject) => {
                this.ws = new WebSocket("wss://localhost:3003?user=" 
                + this.client 
                + "&room=" + this.currentRoom()
            );
            this.ws.onopen = (e) => {    
                console.log("Websocket opened");
                resolve(this);
                //this.connectToRoomClients();
            }
            this.ws.onclose = (e) => {   
                console.log("Websocket closed");
            }
            this.ws.onmessage = (e) => { 
                var json = JSON.parse(e.data);
                if(this.shouldRespond(json)){
                    if(json.action === "candidate"){
                        this.processIce(json.data);
                    } else if(json.action === "offer"){
                        // incoming offer
                        this.endpoint = json.from;
                        this.processOffer(json.data)
                    } else if(json.action === "answer"){
                        // incoming answer
                        this.processAnswer(json.data);
                    }
                }
            }
            this.ws.onerror = (e) => {   
                console.log("Websocket error");
                reject(e);
            }
        })
        
    }

    connectToRoomClients(){
        return new Promise((resolve, reject) => {
            this.peerConnection = new RTCPeerConnection(this.config);
            this.peerConnection.onicecandidate = (e) => {
                if (!this.peerConnection || !e || !e.candidate) return;
                this.sendNegotiation("candidate", e.candidate);
            };
    
            var dataChannel = this.peerConnection.createDataChannel("datachannel");
            dataChannel.onopen = () => {
                console.log("------ DATACHANNEL OPENED ------");
            };
            
            dataChannel.onclose = () => {
                console.log("------ DC closed! ------");
            };
            
            dataChannel.onerror = (err) => {
                console.log("DC ERROR!!!");
                reject(err);
            };
            
            this.dataChannels.push(dataChannel);

            this.peerConnection.ondatachannel = (ev) => {
                console.log('peerConnection.ondatachannel event fired.');
                ev.channel.onopen = () => {
                    console.log('Data channel is open and ready to be used.');
                    dataChannel.send(JSON.stringify({action: "heartbeat", message: "Heartbeat from [" + this.client + "]"}));
                    resolve(this);
                };
                ev.channel.onmessage = (e) => {
                    this.processMessage(e)
                };
            };

            var sdpConstraints = { offerToReceiveAudio: true,  offerToReceiveVideo: false };
            this.peerConnection.createOffer(sdpConstraints).then((sdp) => {
                this.peerConnection.setLocalDescription(sdp);
                this.sendNegotiation("offer", sdp);
                console.log("------ SEND OFFER ------");
            }, (err) => {
                console.log(err)
            });
        })
    }

    sendDirect(msg){
        this.dataChannels.map((channel) => {
            channel.send(msg);
        });
    }

    processMessage(e) {
        console.log("----- DC MESSAGE -----", e.data);
        var message = JSON.parse(e.data);
        if (message.action === "mutation") {
            UIDStore.dispatch(message.action, message);
        }
    }

    createDataChannel() {
        this.peerConnection = new RTCPeerConnection(this.config);
        this.peerConnection.onicecandidate = (e) => {
            if (!this.peerConnection || !e || !e.candidate) return;
            this.sendNegotiation("candidate", e.candidate);
        };

        var dataChannel = this.peerConnection.createDataChannel("datachannel");

        dataChannel.onopen = () => {console.log("------ DATACHANNEL OPENED ------")};       
        dataChannel.onclose = (e) => {console.log("------ DC closed! ------", e)};
        dataChannel.onerror = (e) => {console.log("DC ERROR!!!", e)};

        this.dataChannels.push(dataChannel);

        this.peerConnection.ondatachannel = (ev) => {
            console.log('peerConnection.ondatachannel event fired.');
            ev.channel.onopen = () => {
                console.log('Data channel is open and ready to be used.');
                dataChannel.send(JSON.stringify({action: "heartbeat", message: "Heartbeat from [" + this.client + "]"}));
            };
            ev.channel.onmessage = (e) => {
                this.processMessage(e)
            }
        };
        return this.peerConnection
    }

    sendNegotiation(type, sdp){
        var jsonSend = { protocol: "one-to-room", room: this.currentRoom(), from: this.client, endpoint: this.endpoint, action: type, data: sdp};
        this.ws.send(JSON.stringify(jsonSend));
    }

    processOffer(offer){
        var peerConnection = this.createDataChannel();
        peerConnection.setRemoteDescription(new RTCSessionDescription(offer)).catch(e => {
            console.log(e)
        });

        var sdpConstraints = {'mandatory':
            {
                'OfferToReceiveAudio': false,
                'OfferToReceiveVideo': false
            }
        };

        peerConnection.createAnswer(sdpConstraints).then((sdp) => {
            return peerConnection.setLocalDescription(sdp).then(() => {            
                this.sendNegotiation("answer", sdp);
                console.log("------ SEND ANSWER ------");
            })
        }, (err) => {
            console.log(err)
        });
        console.log("------ PROCESSED OFFER ------");
    };

    processAnswer(answer){
        this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("------ PROCESSED ANSWER ------");
        return true;
    };

    processIce(iceCandidate){
        this.peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidate)).catch(e => {
            console.log(e)
        })
    }

    //export default UIDWebRTC;
    async connect() {
        await this.connectToWebsocket();
        return this.connectToRoomClients();
    };
}

export default UIDCommunication;