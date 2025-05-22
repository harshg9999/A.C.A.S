// assets/js/acas-repertoire-gui.js

class RepertoireGUI {
    /**
     * @param {HTMLElement} containerElement The HTML element to render the tree into.
     * @param {RepertoireTree} repertoireTree The repertoire tree data.
     */
    constructor(containerElement, repertoireTree) {
        this.containerElement = containerElement;
        this.repertoireTree = repertoireTree;
        this.onNodeClickCallback = null; // Callback for when a node is clicked
    }

    /**
     * Sets a callback function to be executed when a tree node is clicked.
     * The callback will receive the FEN of the clicked node.
     * @param {function(string, string): void} callback The function to call. (fen, move)
     */
    onNodeClick(callback) {
        this.onNodeClickCallback = callback;
    }

    /**
     * Renders the repertoire tree in the container element.
     */
    renderTree() {
        if (!this.containerElement) {
            console.error("Repertoire GUI: Container element not set.");
            return;
        }
        if (!this.repertoireTree || !this.repertoireTree.root) {
            console.error("Repertoire GUI: Repertoire tree data not set or root is missing.");
            return;
        }

        this.containerElement.innerHTML = ''; // Clear previous tree
        const ul = document.createElement('ul');
        ul.classList.add('repertoire-tree-root');
        
        this._renderNode(this.repertoireTree.root, ul);
        this.containerElement.appendChild(ul);
    }

    /**
     * Recursively renders a repertoire node and its children.
     * @param {RepertoireNode} repertoireNode The node to render.
     * @param {HTMLElement} parentElement The HTML element to append this node's representation to.
     * @private
     */
    _renderNode(repertoireNode, parentElement) {
        const li = document.createElement('li');
        li.classList.add('repertoire-tree-node');

        const moveSpan = document.createElement('span');
        moveSpan.classList.add('repertoire-move');
        moveSpan.textContent = repertoireNode.move === "root" ? "Start" : repertoireNode.move;
        moveSpan.title = `FEN: ${repertoireNode.fen}
Comment: ${repertoireNode.comment || 'N/A'}`;
        
        // Store FEN and move on the element for easy access
        li.dataset.fen = repertoireNode.fen;
        li.dataset.move = repertoireNode.move;

        if (repertoireNode.children.length > 0) {
            const toggleButton = document.createElement('button');
            toggleButton.classList.add('repertoire-toggle');
            toggleButton.textContent = '-'; // Assume expanded by default
            toggleButton.onclick = (e) => {
                e.stopPropagation(); // Prevent node click event
                const childrenUl = li.querySelector('ul');
                if (childrenUl) {
                    childrenUl.style.display = childrenUl.style.display === 'none' ? 'block' : 'none';
                    toggleButton.textContent = childrenUl.style.display === 'none' ? '+' : '-';
                }
            };
            li.appendChild(toggleButton);
        }

        li.appendChild(moveSpan);

        if (this.onNodeClickCallback) {
            moveSpan.onclick = (e) => {
                e.stopPropagation();
                // Remove 'selected' class from previously selected node
                const currentlySelected = this.containerElement.querySelector('.repertoire-move.selected');
                if (currentlySelected) {
                    currentlySelected.classList.remove('selected');
                }
                // Add 'selected' class to clicked node
                moveSpan.classList.add('selected');
                this.onNodeClickCallback(repertoireNode.fen, repertoireNode.move);
            };
        }
        
        parentElement.appendChild(li);

        if (repertoireNode.children.length > 0) {
            const childrenUl = document.createElement('ul');
            childrenUl.classList.add('repertoire-children');
            // childrenUl.style.display = 'none'; // Start collapsed
            repertoireNode.children.forEach(childNode => {
                this._renderNode(childNode, childrenUl);
            });
            li.appendChild(childrenUl);
        }
    }

    /**
     * Highlights a node in the tree, typically by its FEN.
     * @param {string} fen The FEN of the node to highlight.
     */
    highlightNodeByFen(fen) {
        const previouslySelected = this.containerElement.querySelector('.repertoire-move.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }

        // This is a simple way to find it. Might need optimization for very large trees.
        // It assumes FENs are unique enough for highlighting this way.
        const allMoveSpans = this.containerElement.querySelectorAll('.repertoire-tree-node > .repertoire-move');
        for (const span of allMoveSpans) {
            const nodeLi = span.closest('.repertoire-tree-node');
            if (nodeLi && nodeLi.dataset.fen === fen) {
                span.classList.add('selected');
                // Expand parents if collapsed
                let current = nodeLi.parentElement; // ul
                while(current && !current.classList.contains('repertoire-tree-root')) {
                    if (current.tagName === 'UL' && current.style.display === 'none') {
                        current.style.display = 'block';
                        const toggle = current.previousElementSibling?.previousElementSibling; // span then toggle button
                        if (toggle && toggle.classList.contains('repertoire-toggle')) {
                            toggle.textContent = '-';
                        }
                    }
                    current = current.parentElement; // li
                    if (current) current = current.parentElement; // ul again
                }
                break; 
            }
        }
    }
}

// Example of how it might be instantiated (for testing, not for final use here)
/*
document.addEventListener('DOMContentLoaded', () => {
    // Assume tree is loaded or created as in acas-repertoire-data.js example
    let repertoireData = RepertoireTree.loadFromLocalStorage("myRepertoire");
    if (repertoireData.root.children.length === 0) { // Populate if empty
        const e4 = repertoireData.addMove(repertoireData.root.fen, "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", "e4");
        repertoireData.addMove(e4.fen, "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", "e5");
        repertoireData.saveToLocalStorage("myRepertoire");
    }

    const treeContainer = document.getElementById('repertoireTreeContainer'); // Assuming you have this ID in your HTML
    if (treeContainer) {
        const gui = new RepertoireGUI(treeContainer, repertoireData);
        gui.onNodeClick((fen, move) => {
            console.log(`Node clicked: Move ${move}, FEN ${fen}`);
            // Here you would typically update the main chessboard
        });
        gui.renderTree();
        
        // Example of highlighting a node:
        // const e5Node = repertoireData.findNodeByMoves(["e4", "e5"]);
        // if (e5Node) {
        //     gui.highlightNodeByFen(e5Node.fen);
        // }
    }
});
*/
// Make class available (optional for now)
// export { RepertoireGUI };
