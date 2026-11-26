/**
 * pi-simple-tps — average tokens per second across the last 10 responses.
 *
 * The footer shows one number: output tokens divided by decode time, summed over
 * the most recent completed assistant responses. Nothing is estimated mid-stream
 * and nothing is displayed until the first response finishes.
 *
 * Commands:
 *   /tps          toggle the widget on/off
 *   /tps reset    clear the window
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const STATUS_KEY = "tps";

/** How many completed responses the average covers. */
const MAX_SAMPLES = 10;

/** Bytes-per-token estimate, used only when a provider reports no usage. */
const BYTES_PER_TOKEN = 4;

/** Decode spans shorter than this fall back to the full request time. */
const MIN_DECODE_SECONDS = 0.05;

interface Sample {
	/** Output tokens of one completed response. */
	tokens: number;
	/** Seconds the response spent decoding. */
	seconds: number;
}

const encoder = new TextEncoder();
const samples: Sample[] = [];

let enabled = true;

/** Start of the current assistant request, undefined while idle. */
let requestStart: number | undefined;
/** Time of the current request's first streamed delta. */
let firstOutputAt: number | undefined;
/** Estimated output of the current request, used when usage is missing. */
let streamTokens = 0;

function paint(ctx: ExtensionContext, token: "accent", text: string): string {
	return ctx.ui.theme.fg(token, text);
}

function formatRate(rate: number): string {
	if (!Number.isFinite(rate) || rate <= 0) return "0";
	return `${Math.round(rate)}`;
}

/** Duration-weighted average: total tokens over total decode time. */
function averageRate(): number | undefined {
	let tokens = 0;
	let seconds = 0;
	for (const sample of samples) {
		tokens += sample.tokens;
		seconds += sample.seconds;
	}
	if (seconds <= 0) return undefined;
	return tokens / seconds;
}

function statusText(ctx: ExtensionContext): string | undefined {
	if (!enabled) return undefined;
	const rate = averageRate();
	if (rate === undefined) return undefined;
	return paint(ctx, "accent", `${formatRate(rate)} tok/s`);
}

function render(ctx: ExtensionContext): void {
	ctx.ui.setStatus(STATUS_KEY, statusText(ctx));
}

function record(tokens: number, seconds: number): void {
	samples.push({ tokens, seconds });
	while (samples.length > MAX_SAMPLES) samples.shift();
}

function resetRequest(): void {
	requestStart = undefined;
	firstOutputAt = undefined;
	streamTokens = 0;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		samples.length = 0;
		resetRequest();
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});

	pi.on("message_start", async (event, _ctx) => {
		if (event.message.role !== "assistant") return;
		resetRequest();
		requestStart = Date.now();
	});

	pi.on("message_update", async (event, _ctx) => {
		if (event.message.role !== "assistant" || requestStart === undefined) return;

		const delta = event.assistantMessageEvent;
		if (delta.type !== "text_delta" && delta.type !== "thinking_delta" && delta.type !== "toolcall_delta") return;

		firstOutputAt ??= Date.now();
		streamTokens += encoder.encode(delta.delta).length / BYTES_PER_TOKEN;
	});

	pi.on("message_end", async (event, ctx) => {
		if (event.message.role !== "assistant") return;

		const now = Date.now();
		const start = requestStart;
		const firstOutput = firstOutputAt;
		const estimate = Math.round(streamTokens);
		resetRequest();

		// Providers that report usage give the exact count; otherwise fall back to the stream estimate.
		const reported = event.message.usage?.output ?? 0;
		const tokens = reported > 0 ? reported : estimate;
		if (tokens <= 0) return;

		// Decode time runs from the first visible output to the end of the message. A response that only
		// emits at its very end leaves no decode span, so fall back to the full request time.
		const decodeFrom = firstOutput ?? start ?? now;
		const decodeSeconds = Math.max(0, now - decodeFrom) / 1000;
		const requestSeconds = start === undefined ? decodeSeconds : Math.max(0, now - start) / 1000;
		const seconds = decodeSeconds >= MIN_DECODE_SECONDS ? decodeSeconds : requestSeconds;
		if (seconds <= 0) return;

		record(tokens, seconds);
		render(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		resetRequest();
		ctx.ui.setStatus(STATUS_KEY, undefined);
	});

	pi.registerCommand("tps", {
		description: "Average tokens/second over the last 10 responses: toggle the widget or reset it.",
		handler: async (args, ctx) => {
			const arg = args.trim().toLowerCase();

			if (arg === "" || arg === "on" || arg === "off") {
				enabled = arg === "" ? !enabled : arg === "on";
			} else if (arg === "reset") {
				samples.length = 0;
				render(ctx);
				ctx.ui.notify("tps: window reset", "info");
				return;
			} else {
				ctx.ui.notify("Usage: /tps [on|off|reset]", "error");
				return;
			}

			render(ctx);
			ctx.ui.notify(`tps: ${enabled ? "shown" : "hidden"}`, "info");
		},
	});
}
