export default {
	async fetch(request, env, ctx): Promise<Response> {
		// Static assets are served automatically from the public directory
		// This handler is for any API routes if needed in the future
		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
