import { IJobUpdate } from "@continuum/core";
import mqtt from 'mqtt/dist/mqtt.esm'
import { MQTT_BASE } from "./ApiConfig";
import { mqttTopicLevel } from "../../common/SafeEncoding";

export interface IExecutionMessage {
    jobId: string;
    data: IJobUpdate;
}

export interface WatchEventHandler {
    onmessage?: (event: IExecutionMessage) => void;
    onclose?: () => void;
    close: () => void;
}

export default class ExecutionService {

    private readonly mqttBaseUrl: string = MQTT_BASE;
    private readonly MQTT_TOPIC_PREFIX = "continuum/workflow/execution"

    watch(executionId: string): WatchEventHandler {
        // Create a proxy for Websocket
        console.log("mqtt=", mqtt);
        const topic = `${this.MQTT_TOPIC_PREFIX}/${mqttTopicLevel(executionId)}/update`;
        let client = mqtt.connect(this.mqttBaseUrl);
        client.subscribe(topic);
        let handler: WatchEventHandler = {
            close: () => {
                client.end();
            }
        }
        client.on('message', (messageTopic, message) => {
            if (messageTopic.startsWith(topic)) {
                handler.onmessage && handler.onmessage(JSON.parse(message.toString()) as IExecutionMessage);
            }
        });
        client.on('close', () => {
            handler.onclose && handler.onclose();
        });
        return handler;
    }
}