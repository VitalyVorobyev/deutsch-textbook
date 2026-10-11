/** The session pages' shared content files — see src/lib/corpus-payload.ts. */
import type { APIRoute, GetStaticPaths } from 'astro';
import { corpusFiles } from '../../lib/corpus-payload';

export const getStaticPaths = (async () =>
  (await corpusFiles()).map((file) => ({ params: { name: file.name }, props: { body: file.body } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(props.body as string, { headers: { 'content-type': 'application/json; charset=utf-8' } });
