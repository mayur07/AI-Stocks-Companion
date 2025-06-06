import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface SimplifiedModel {
  type: string;
  config: {
    vocab_size: number;
    max_position_embeddings: number;
    encoder_layers: number;
    decoder_layers: number;
    encoder_attention_heads: number;
    decoder_attention_heads: number;
    encoder_ffn_dim: number;
    decoder_ffn_dim: number;
    d_model: number;
  };
  isSimplified: boolean;
}

type ModelResponse = SimplifiedModel | ArrayBuffer;

@Injectable({
  providedIn: 'root'
})
export class ModelLoaderService {
  private readonly MODEL_BASE_PATH = '/assets/models/bart-large-cnn';
  private readonly REMOTE_MODEL_URL = 'https://huggingface.co/facebook/bart-large-cnn/resolve/main';
  private cache: Map<string, any> = new Map();

  constructor(private http: HttpClient) {}

  loadTokenizerConfig(): Observable<any> {
    const cacheKey = 'tokenizer_config';
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey));
    }

    return this.http.get(`${this.MODEL_BASE_PATH}/tokenizer_config.json`).pipe(
      catchError(error => {
        console.warn('Failed to load local tokenizer config, falling back to remote:', error);
        return this.http.get(`${this.REMOTE_MODEL_URL}/tokenizer_config.json`).pipe(
          catchError(remoteError => {
            console.warn('Failed to load remote tokenizer config, using default:', remoteError);
            return of({
              model_type: 'bart',
              pad_token: '<pad>',
              bos_token: '<s>',
              eos_token: '</s>',
              unk_token: '<unk>',
              mask_token: '<mask>',
              sep_token: '</s>',
              cls_token: '<s>',
              max_position_embeddings: 1024,
              vocab_size: 50265
            });
          })
        );
      }),
      map(config => {
        this.cache.set(cacheKey, config);
        return config;
      })
    );
  }

  loadModelConfig(): Observable<any> {
    const cacheKey = 'model_config';
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey));
    }

    return this.http.get(`${this.MODEL_BASE_PATH}/config.json`).pipe(
      catchError(error => {
        console.warn('Failed to load local model config, falling back to remote:', error);
        return this.http.get(`${this.REMOTE_MODEL_URL}/config.json`).pipe(
          catchError(remoteError => {
            console.warn('Failed to load remote model config, using default:', remoteError);
            return of({
              model_type: 'bart',
              architectures: ['BartForConditionalGeneration'],
              pad_token: '<pad>',
              bos_token: '<s>',
              eos_token: '</s>',
              unk_token: '<unk>',
              mask_token: '<mask>',
              sep_token: '</s>',
              cls_token: '<s>',
              max_position_embeddings: 1024,
              vocab_size: 50265,
              encoder_layers: 12,
              decoder_layers: 12,
              encoder_attention_heads: 16,
              decoder_attention_heads: 16,
              encoder_ffn_dim: 4096,
              decoder_ffn_dim: 4096,
              d_model: 1024
            });
          })
        );
      }),
      map(config => {
        this.cache.set(cacheKey, config);
        return config;
      })
    );
  }

  loadTokenizer(): Observable<any> {
    const cacheKey = 'tokenizer';
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey));
    }

    return this.http.get(`${this.MODEL_BASE_PATH}/tokenizer.json`).pipe(
      catchError(error => {
        console.warn('Failed to load local tokenizer, falling back to remote:', error);
        return this.http.get(`${this.REMOTE_MODEL_URL}/tokenizer.json`).pipe(
          catchError(remoteError => {
            console.warn('Failed to load remote tokenizer, using default:', remoteError);
            return of({
              version: '1.0',
              truncation: {
                max_length: 1024,
                stride: 0,
                strategy: 'longest_first'
              },
              padding: {
                max_length: 1024,
                padding_side: 'right',
                pad_to_multiple_of: 0
              }
            });
          })
        );
      }),
      map(tokenizer => {
        this.cache.set(cacheKey, tokenizer);
        return tokenizer;
      })
    );
  }

  loadModel(): Observable<ModelResponse> {
    const cacheKey = 'model';
    if (this.cache.has(cacheKey)) {
      return of(this.cache.get(cacheKey));
    }

    // For development/testing, we'll use a simplified model representation
    // In production, this would load the actual model binary
    const simplifiedModel: SimplifiedModel = {
      type: 'bart',
      config: {
        vocab_size: 50265,
        max_position_embeddings: 1024,
        encoder_layers: 12,
        decoder_layers: 12,
        encoder_attention_heads: 16,
        decoder_attention_heads: 16,
        encoder_ffn_dim: 4096,
        decoder_ffn_dim: 4096,
        d_model: 1024
      },
      isSimplified: true
    };

    // In development, return the simplified model
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.warn('Using simplified model for development');
      this.cache.set(cacheKey, simplifiedModel);
      return of(simplifiedModel);
    }

    // In production, try to load from remote
    return this.http.get(`${this.REMOTE_MODEL_URL}/pytorch_model.bin`, { responseType: 'arraybuffer' }).pipe(
      catchError(error => {
        console.warn('Failed to load remote model, using simplified model:', error);
        this.cache.set(cacheKey, simplifiedModel);
        return of(simplifiedModel);
      }),
      map(model => {
        if ('isSimplified' in model) {
          return model;
        }
        this.cache.set(cacheKey, model);
        return model;
      })
    );
  }

  clearCache(): void {
    this.cache.clear();
  }
} 