import { INodeOutputs } from "./IBaseNode"

export default interface INodeToOutputsMap {
    [nodeId: string]: INodeOutputs
}