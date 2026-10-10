<script lang="ts">
	import { untrack } from 'svelte';
	import { Button, Dialog } from '$lib/ui/win2k';
	import { reportText, runDiagnostics, type DiagnosticsReport } from './diagnostics';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	let running = $state(false);
	let report = $state.raw<DiagnosticsReport | null>(null);
	let failure = $state<string | null>(null);
	let copied = $state(false);

	const passed = $derived(report?.checks.every((c) => c.ok) ?? false);

	async function run() {
		running = true;
		report = null;
		failure = null;
		copied = false;
		try {
			report = await runDiagnostics();
		} catch (err) {
			failure = err instanceof Error ? err.message : String(err);
		} finally {
			running = false;
		}
	}

	$effect(() => {
		if (open) untrack(run);
	});

	async function copy() {
		if (!report) return;
		await navigator.clipboard.writeText(reportText(report));
		copied = true;
	}
</script>

<Dialog bind:open title="Diagnostics" width={460}>
	{#if running}
		<p>Running GPU checks…</p>
	{:else if failure}
		<p>The checks could not run: {failure}</p>
	{:else if report}
		<p>GPU: <b>{report.adapter}</b></p>
		<div class="frame">
			<table>
				<thead>
					<tr><th>Check</th><th>Result</th></tr>
				</thead>
				<tbody>
					{#each report.checks as check (check.name)}
						<tr>
							<td>{check.name}<span class="detail">{check.detail}</span></td>
							<td class:fail={!check.ok}>{check.ok ? 'Passed' : 'FAILED'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<p>{passed ? 'All checks passed.' : 'Some checks failed. Copy the results and send them to AGR support.'}</p>
	{/if}
	{#snippet buttons()}
		<Button onclick={copy} disabled={!report}>{copied ? 'Copied' : 'Copy Results'}</Button>
		<Button onclick={run} disabled={running}>Run Again</Button>
		<Button default onclick={() => (open = false)}>Close</Button>
	{/snippet}
</Dialog>

<style>
	p {
		margin: 0 0 8px;
	}
	.frame {
		max-height: 240px;
		margin-bottom: 8px;
		overflow: auto;
		background: var(--window);
		box-shadow: var(--sunken);
		padding: 2px;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th {
		position: sticky;
		top: 0;
		padding: 2px 6px;
		background: var(--face);
		box-shadow: var(--header);
		font-weight: normal;
		text-align: left;
	}
	td {
		padding: 3px 6px;
		border-bottom: 1px solid var(--face);
		vertical-align: top;
		user-select: text;
	}
	td:last-child {
		width: 60px;
	}
	.detail {
		display: block;
		color: var(--gray-text);
	}
	.fail {
		color: #c00000;
		font-weight: bold;
	}
</style>
