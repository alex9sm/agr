<script lang="ts">
	import { resolve } from '$app/paths';

	let password = $state('');
	let failed = $state(false);

	// No backend yet: every attempt reports that the account does not exist.
	function onsubmit(e: SubmitEvent) {
		e.preventDefault();
		password = '';
		failed = true;
	}
</script>

<svelte:head><title>Login - AGR</title></svelte:head>

<h2>Customer Portal Login</h2>

<p>Existing customers can sign in to access the customer portal, downloads, license keys, and support tickets.</p>

<!-- method="post" so a submit before hydration never puts the password in the URL. -->
<form class="login" method="post" {onsubmit}>
	<table class="spec">
		<tbody>
			<tr>
				<th><label for="login-user">Username</label></th>
				<td><input id="login-user" name="username" type="text" autocomplete="username" required></td>
			</tr>
			<tr>
				<th><label for="login-pass">Password</label></th>
				<td><input id="login-pass" name="password" type="password" autocomplete="current-password" required bind:value={password}></td>
			</tr>
		</tbody>
	</table>
	<button type="submit">Log In</button>
	<p class="error mono" role="alert" hidden={!failed}>This account does not exist.</p>
</form>

<p>Not a customer yet? <a href={resolve('/contact')}>Contact us &raquo;</a></p>
