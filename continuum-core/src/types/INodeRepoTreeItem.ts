import { IBaseNodeData } from "./IBaseNode";

export default interface INodeRepoTreeItem {
    id: string;
    name: string;
    nodeInfo?: IBaseNodeData;
    children?: INodeRepoTreeItem[];
}