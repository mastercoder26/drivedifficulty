declare module "onnxruntime-node" {
  export class Tensor {
    constructor(type: string, data: Float32Array, dims: number[]);
  }
  export namespace InferenceSession {
    function create(path: string): Promise<{
      run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: Float32Array }>>;
    }>;
  }
}
