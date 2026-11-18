/* Cloudflare Worker entry for the SHK JAVED "Talk to Me" Gemini proxy. All logic lives in twin.js,
   which also exports the validator for the offline tests (node test.mjs). */
import { handleRequest } from './twin.js';

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
