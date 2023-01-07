
export class DijkstraPathFinder {
  #graph
  #startNode
  #endNode

  #distances = {}
  #parents = {}
  #visited = []

  #shortestDistanceNode() {
    let shortest = null
    const distances = this.#distances

    Object.keys(distances).forEach((node) => {
      if (
        (shortest === null || distances[node] < distances[shortest]) &&
        !this.#visited.includes(node)
      ) {
        shortest = node
      }
    })

    return shortest
  }
  #recalculateNodes(node) {
    const distances = this.#distances
    const distance = distances[node]
    const children = this.#graph[node]

    Object.keys(children).forEach((child) => {
      const isStartChild = String(child) === String(this.#startNode)
      if (isStartChild) return
      const newdistance = distance + children[child]
      if (!distances[child] || distances[child] > newdistance) {
        distances[child] = newdistance
        this.#parents[child] = node
      }
    })

    this.#visited.push(node)
  }

  constructor(graph, startNode, endNode) {
    this.#graph = graph
    this.#startNode = startNode
    this.#endNode = endNode

    const firstSubGraph = graph[startNode]
    this.#distances = {
      [endNode]: Infinity,
      ...firstSubGraph,
    }

    const parents = {
      endNode: null,
    }
    Object.keys(firstSubGraph).forEach((childNode) => {
      parents[childNode] = startNode
    })
    this.#parents = parents
  }

  findPath() {
    let node = this.#shortestDistanceNode()
    while (node) {
      this.#recalculateNodes(node)
      node = this.#shortestDistanceNode()
    }

    const shortestPath = [this.#endNode]
    const parents = this.#parents
    let parent = parents[this.#endNode]
    while (parent) {
      shortestPath.push(parent)
      parent = parents[parent]
    }
    shortestPath.reverse()

    return {
      distance: this.#distances[this.#endNode],
      path: shortestPath,
    }
  }
}
