<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<aside class="index">
	<h2 class="label">Index</h2>
	<ol class="mono">
		<li><a href={resolve('/products')}>Products</a></li>
		<li><a href={resolve('/services')}>Services</a></li>
		<li><a href={resolve('/about')}>About AGR</a></li>
		<li><a href={resolve('/contact')}>Contact</a></li>
		<li><a href={resolve('/login')}>Customer Login</a></li>
	</ol>
	<h2 class="label">Support</h2>
	<p>Customers can open a ticket or call the support line after <a href={resolve('/login')}>logging in</a>.</p>
</aside>
