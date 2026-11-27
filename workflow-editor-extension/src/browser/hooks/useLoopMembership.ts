import { useNodes } from 'reactflow';
import { enclosingLoops, isLoopNode, GraphLike } from '../../common/LoopTopology';

/**
 * Detects if a node is a member of a Loop and provides its nesting information.
 *
 * Returns null for:
 * - Top-level nodes (no enclosing Loop)
 * - Loop nodes themselves (type === 'Loop')
 *
 * Returns membership details for direct and nested Loop members.
 *
 * @param nodeId - The node ID to check for Loop membership
 * @returns Object with parentLoopId and nestingDepth, or null if not a Loop member
 */
export function useLoopMembership(
    nodeId: string,
): { parentLoopId: string | null; nestingDepth: number } | null {
    const nodes = useNodes();

    // Build a graph-like structure for enclosingLoops
    const graph: GraphLike = { nodes: nodes as any, edges: [] };

    // Check if this node is a Loop node itself; Loops are not styled as members
    const node = nodes.find((n) => n.id === nodeId);
    if (node && isLoopNode(node.type ?? '')) {
        return null;
    }

    // Find all enclosing loops from innermost to outermost
    const enclosingLoopScopes = enclosingLoops(nodeId, graph);

    // No enclosing loops means this is a top-level node
    if (enclosingLoopScopes.length === 0) {
        return null;
    }

    // The innermost loop is the direct parent (the loop containing this node)
    const innermostLoop = enclosingLoopScopes[enclosingLoopScopes.length - 1];
    
    // The member node gets the same color as its parent loop.
    // The parent loop's nesting depth = how many loops the parent is inside.
    // If we have N enclosing loops, the parent is the last one (innermost),
    // and it is inside (N-1) other loops. Cap at 3 to match LOOP_NESTING_STYLES.
    const parentLoopNestingDepth = Math.min(3, Math.max(0, enclosingLoopScopes.length - 1));

    return {
        parentLoopId: innermostLoop.loopId,
        nestingDepth: parentLoopNestingDepth,
    };
}
