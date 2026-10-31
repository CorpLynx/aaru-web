<!-- AARU: branded error page. Shows the status and a plain explanation; internal
     error details are never shown, and every error page links home and to the
     legal pages served at /legal/. -->
<script>
	import { page } from '$app/stores';

	$: status = $page.status;
	$: title =
		status === 404
			? 'Page not found'
			: status === 401 || status === 403
				? 'You do not have access to this page'
				: status >= 500
					? 'Something went wrong'
					: 'This request could not be completed';
	$: detail =
		status === 404
			? 'The page you are looking for does not exist or has moved.'
			: status === 401 || status === 403
				? 'Sign in with an account that has access, or ask the operator.'
				: status >= 500
					? 'Aaru hit an error on its side. Try again in a moment; if it keeps happening, contact the operator.'
					: 'Check the address and try again.';
</script>

<svelte:head>
	<title>{status} · Aaru</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main
	class="min-h-screen bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-100 flex items-center"
>
	<div class="mx-auto max-w-md px-6 py-16 text-center">
		<div class="font-mono text-sm tracking-widest text-gray-500">{status}</div>
		<h1 class="mt-3 text-2xl font-semibold">{title}</h1>
		<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">{detail}</p>
		<a
			href="/"
			class="mt-8 inline-flex h-10 items-center rounded-lg bg-gray-900 px-5 text-sm font-medium text-white dark:bg-gray-100 dark:text-gray-900"
			>Back to Aaru</a
		>
		<nav class="mt-10 flex justify-center gap-4 text-xs text-gray-500">
			<a href="/legal/terms.html" class="hover:underline">Terms</a>
			<a href="/legal/privacy.html" class="hover:underline">Privacy</a>
			<a href="/legal/security.html" class="hover:underline">Security</a>
		</nav>
	</div>
</main>
