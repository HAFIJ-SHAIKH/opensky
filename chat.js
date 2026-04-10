export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();

        if (!env.key) {
            return new Response(JSON.stringify({ error: 'API key not configured' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const proxyBody = {
            model: body.model,
            messages: body.messages,
            stream: body.stream || false,
            max_tokens: body.max_tokens || 2048,
            temperature: body.temperature || 0.7,
            top_p: body.top_p || 0.9
        };

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.key}`,
                'HTTP-Referer': request.headers.get('origin') || 'https://opensky.pages.dev',
                'X-Title': 'Opensky AI'
            },
            body: JSON.stringify(proxyBody)
        });

        if (body.stream && response.ok) {
            return new Response(response.body, {
                status: 200,
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            });
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
