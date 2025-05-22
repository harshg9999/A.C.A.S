// assets/js/acas-repertoire-data.js

/**
 * Represents a single node in the repertoire tree.
 */
class RepertoireNode {
    /**
     * @param {string} fen The FEN string for the position.
     * @param {string} move The move notation (e.g., "e4", "Nf3") that led to this position.
     * @param {RepertoireNode | null} parent The parent node (null for the root).
     */
    constructor(fen, move, parent = null) {
        this.fen = fen; // Forsyth-Edwards Notation of the position
        this.move = move; // Move notation (e.g., "e4", "Nf3") that led to this position
        this.parent = parent; // Parent node
        this.children = []; // Array of RepertoireNode children
        this.comment = ""; // User comment for this position/move
        this.labels = []; // User-defined labels (e.g., "sharp", "main line")
        // Potential future additions:
        // this.statistics = { wins: 0, losses: 0, draws: 0 };
    }

    /**
     * Adds a child node to this node.
     * @param {RepertoireNode} childNode The child node to add.
     */
    addChild(childNode) {
        this.children.push(childNode);
    }

    /**
     * Finds a child node by the move notation.
     * @param {string} move The move notation to search for.
     * @returns {RepertoireNode | undefined} The found child node, or undefined.
     */
    findChildByMove(move) {
        return this.children.find(child => child.move === move);
    }
}

/**
 * Represents the entire repertoire tree.
 */
class RepertoireTree {
    constructor(rootFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
        this.root = new RepertoireNode(rootFen, "root");
        this.nodeMap = new Map(); // For quick lookup of nodes by FEN
        this.nodeMap.set(rootFen, this.root);
    }

    /**
     * Adds a new move (and the resulting position) to the tree.
     * @param {string} parentFen The FEN of the parent position.
     * @param {string} newFen The FEN of the new position after the move.
     * @param {string} move The move notation that led to the new position.
     * @returns {RepertoireNode | null} The newly created node, or null if the parent FEN doesn't exist.
     */
    addMove(parentFen, newFen, move) {
        const parentNode = this.nodeMap.get(parentFen);
        if (!parentNode) {
            console.error(`Parent FEN ${parentFen} not found in repertoire tree.`);
            return null;
        }

        // Check if this move already exists from the parent
        let existingNode = parentNode.findChildByMove(move);
        if (existingNode) {
            // If FENs don't match, it's an issue (e.g. different transpositions leading to same FEN from different parents,
            // or simply an incorrect newFen provided for an existing move)
            // For now, we'll assume if move exists, it's the same line.
            // More sophisticated handling might be needed for transpositions.
            if (existingNode.fen !== newFen) {
                console.warn(`Move ${move} from ${parentFen} already exists but leads to ${existingNode.fen}, not ${newFen}. Using existing node.`);
            }
            return existingNode;
        }
        
        // If the new FEN already has a node (e.g. transposition from another line),
        // we might want to link to it, but for simplicity now, we create a new node.
        // Proper transposition handling is complex.
        if (this.nodeMap.has(newFen) && this.nodeMap.get(newFen).parent !== parentNode) {
             console.warn(`FEN ${newFen} already exists in the tree from a different line. Creating a new node for this path.`);
             // To handle transpositions correctly, one might link this parent to the existing FEN node,
             // making the tree a graph (DAG). For now, we keep it strictly a tree, duplicating FENs if necessary
             // or deciding on a primary line. For this basic version, we'll create a new node.
        }

        const newNode = new RepertoireNode(newFen, move, parentNode);
        parentNode.addChild(newNode);
        this.nodeMap.set(newFen, newNode);
        return newNode;
    }

    /**
     * Finds a node by its FEN.
     * @param {string} fen The FEN to search for.
     * @returns {RepertoireNode | undefined}
     */
    findNodeByFen(fen) {
        return this.nodeMap.get(fen);
    }

    /**
     * Finds a node by a sequence of moves from the root.
     * @param {string[]} movesSequence An array of move notations.
     * @returns {RepertoireNode | undefined}
     */
    findNodeByMoves(movesSequence) {
        let currentNode = this.root;
        for (const move of movesSequence) {
            const nextNode = currentNode.findChildByMove(move);
            if (!nextNode) {
                return undefined; // Move sequence not found
            }
            currentNode = nextNode;
        }
        return currentNode;
    }

    /**
     * Serializes the tree to a JSON string for storage.
     * We need a custom serializer because of circular parent references.
     */
    serialize() {
        const simplifiedNodes = [];
        // Traverse the tree (e.g., BFS or DFS) and create a simplified representation
        // For simplicity, we'll store a list of nodes with parentFen and move, then reconstruct.
        // A more robust way would be to assign unique IDs to each node.

        const queue = [this.root];
        const visitedFens = new Set(); // To handle potential (though currently not implemented) graph structures or duplicates if we change nodeMap logic

        while (queue.length > 0) {
            const node = queue.shift();
            if (visitedFens.has(node.fen + '_' + node.move)) continue; // Simple way to avoid reprocessing, might need refinement if FENs can repeat with different moves to them
            visitedFens.add(node.fen + '_' + node.move);

            simplifiedNodes.push({
                fen: node.fen,
                move: node.move,
                comment: node.comment,
                labels: node.labels,
                parentFen: node.parent ? node.parent.fen : null,
                parentMove: node.parent ? node.parent.move : null // Store parent's move too for better reconstruction context
            });

            node.children.forEach(child => queue.push(child));
        }
        return JSON.stringify(simplifiedNodes);
    }

    /**
     * Deserializes the tree from a JSON string.
     * @param {string} jsonString The JSON string representing the tree.
     * @param {string} [initialRootFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"] The FEN to expect for the root node.
     */
    static deserialize(jsonString, initialRootFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
        const simplifiedNodes = JSON.parse(jsonString);
        if (!simplifiedNodes || simplifiedNodes.length === 0) {
            return new RepertoireTree(initialRootFen); // Return empty tree if no data
        }

        const rootData = simplifiedNodes.find(n => n.move === "root" && n.fen === initialRootFen);
        if (!rootData) {
            console.error("Root node not found in serialized data or FEN mismatch. Cannot deserialize.");
            return new RepertoireTree(initialRootFen); // Or throw an error
        }

        const tree = new RepertoireTree(rootData.fen);
        tree.root.comment = rootData.comment || "";
        tree.root.labels = rootData.labels || [];
        
        // Rebuild nodeMap first for all nodes
        // This simple reconstruction assumes parentFen + parentMove uniquely identifies parent in the list during reconstruction
        // This is not robust if a FEN can be a parent via different moves (which shouldn't happen in a strict tree from a single root FEN)
        
        const nodeLookup = new Map(); // temp lookup for reconstruction: 'fen_move' -> nodeData
        simplifiedNodes.forEach(data => {
            nodeLookup.set(data.fen + '_' + data.move, data);
        });

        // Create all nodes and map them
        simplifiedNodes.forEach(data => {
            if (data.fen === tree.root.fen && data.move === "root") {
                // Root already created
                tree.nodeMap.set(data.fen, tree.root); // Ensure root is in nodeMap
            } else {
                // For other nodes, we ensure they are created.
                // The actual linking to parent happens in the next loop.
                // This simplified addMove won't work directly here as parent might not be processed yet.
                // We need to create nodes first, then link.
                if (!tree.nodeMap.has(data.fen)) {
                     // If multiple moves lead to the SAME FEN, this will map only the first one encountered.
                     // This is a limitation of current FEN-based nodeMap for transpositions.
                     // For repertoire, usually we care about the *path* (sequence of moves).
                    const tempNode = new RepertoireNode(data.fen, data.move); // Parent will be linked later
                    tempNode.comment = data.comment || "";
                    tempNode.labels = data.labels || [];
                    tree.nodeMap.set(data.fen, tempNode);
                }
            }
        });
        
        // Link children to parents
        simplifiedNodes.forEach(data => {
            if (data.parentFen !== null) {
                const childNode = tree.nodeMap.get(data.fen); // Should exist from previous loop (or be the root)
                // A FEN might appear multiple times if different moves lead to it (transpositions).
                // We need to be more specific: find the node corresponding to this *specific path*.
                // The current nodeMap.get(data.fen) is ambiguous if FENs are not unique.
                // This deserialization will be problematic with transpositions if nodeMap uses FEN as key and FENs are not unique.
                // For now, let's assume we are fetching the correct child instance.
                
                const parentNode = tree.nodeMap.get(data.parentFen);

                if (childNode && parentNode) {
                    // Check if child is already there (it shouldn't be based on current addMove logic)
                    if (!parentNode.children.some(c => c.fen === childNode.fen && c.move === childNode.move)) {
                        childNode.parent = parentNode; // Set parent link
                        // Ensure the node's move matches the one from serialized data, as nodeMap might give a shared FEN node
                        childNode.move = data.move; 
                        parentNode.addChild(childNode);
                    }
                } else {
                    console.warn("Could not link child to parent during deserialization:", data);
                }
            }
        });
        
        // Second pass to ensure all nodes from simplifiedNodes are correctly in the tree and nodeMap
        // This is tricky due to how nodeMap handles FENs that might not be unique across different lines.
        // The current addMove and nodeMap are designed for a tree where FENs are mostly unique per path.
        // For a robust repertoire tool, node identity should probably be based on a unique ID or path, not just FEN.
        // Re-populating nodeMap based on the *reconstructed tree* rather than serialized list might be safer.
        tree.nodeMap.clear();
        const q = [tree.root];
        while(q.length > 0) {
            const n = q.shift();
            tree.nodeMap.set(n.fen, n); // This will overwrite if FENs are not unique, last one processed wins.
            n.children.forEach(c => q.push(c));
        }


        return tree;
    }

    /**
     * Saves the current repertoire tree to local storage.
     * @param {string} storageKey The key to use for local storage.
     */
    saveToLocalStorage(storageKey = "acasRepertoire") {
        try {
            const serializedTree = this.serialize();
            localStorage.setItem(storageKey, serializedTree);
            console.log("Repertoire saved to local storage.");
        } catch (error) {
            console.error("Error saving repertoire to local storage:", error);
        }
    }

    /**
     * Loads a repertoire tree from local storage.
     * @param {string} storageKey The key to use for local storage.
     * @param {string} [initialRootFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"] The FEN of the root node for a new tree if loading fails or no data.
     * @returns {RepertoireTree} The loaded tree, or a new empty tree if loading fails or no data.
     */
    static loadFromLocalStorage(storageKey = "acasRepertoire", initialRootFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
        try {
            const serializedTree = localStorage.getItem(storageKey);
            if (serializedTree) {
                console.log("Repertoire loaded from local storage.");
                return RepertoireTree.deserialize(serializedTree, initialRootFen);
            } else {
                console.log("No repertoire found in local storage, creating a new one.");
                return new RepertoireTree(initialRootFen);
            }
        } catch (error) {
            console.error("Error loading repertoire from local storage:", error);
            return new RepertoireTree(initialRootFen);
        }
    }
}

// Example Usage (for testing purposes, can be removed later)

// Create a new tree or load from local storage
let tree = RepertoireTree.loadFromLocalStorage("myRepertoire");

// If the tree is empty (e.g., first time run or cleared local storage), add some moves
if (tree.root.children.length === 0) {
    console.log("Tree is empty, adding initial moves for testing.");
    const e4Node = tree.addMove(tree.root.fen, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", "e4");
    if (e4Node) {
        e4Node.comment = "King's Pawn Opening";
        const c5Node = tree.addMove(e4Node.fen, "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2", "c5");
        if (c5Node) {
            c5Node.comment = "Sicilian Defense";
            const nf3Node = tree.addMove(c5Node.fen, "rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", "Nf3");
            if (nf3Node) {
                nf3Node.comment = "Open Sicilian";
            }
        }
        const e5Node = tree.addMove(e4Node.fen, "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", "e5");
        if (e5Node) {
            e5Node.comment = "King's Pawn Game";
        }
    }
    tree.saveToLocalStorage("myRepertoire");
} else {
    console.log("Tree loaded from local storage with existing moves.");
}

// Test finding nodes
console.log("Root node:", tree.root);
console.log("Finding e4:", tree.findNodeByMoves(["e4"]));
console.log("Finding e4, c5:", tree.findNodeByMoves(["e4", "c5"]));
console.log("Finding e4, c5, Nf3:", tree.findNodeByMoves(["e4", "c5", "Nf3"]));
const nonExistentNode = tree.findNodeByMoves(["d4", "d5"]);
console.log("Finding d4, d5 (should be undefined if not added):", nonExistentNode);

// Test serialization output
// console.log("Serialized tree:", tree.serialize());

// To test deserialization independently:
// const serialized = tree.serialize();
// const deserializedTree = RepertoireTree.deserialize(serialized);
// console.log("Deserialized tree root:", deserializedTree.root);
// console.log("Deserialized tree, finding e4, c5:", deserializedTree.findNodeByMoves(["e4", "c5"]));


// Make classes available for other modules if using ES6 modules (optional for now)
// export { RepertoireNode, RepertoireTree };
