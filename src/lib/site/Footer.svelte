<script lang="ts">
	import { asset, resolve } from '$app/paths';
</script>

<footer class="site-footer">
	<div class="cell">
		<h2 class="label">AGR Holdings LLC</h2>
		<p>Software and consulting solutions for logistics, graphics, and defense.</p>
		<p class="mono"><a href="mailto:info@advancedgr.com">info@advancedgr.com</a></p>
	</div>
	<div class="cell">
		<h2 class="label">Site</h2>
		<ul class="mono">
			<li><a href={resolve('/')}>Home</a></li>
			<li><a href={resolve('/products')}>Products</a></li>
			<li><a href={resolve('/services')}>Services</a></li>
			<li><a href={resolve('/about')}>About</a></li>
			<li><a href={resolve('/contact')}>Contact</a></li>
			<li><a href={resolve('/login')}>Customer Login</a></li>
		</ul>
	</div>
	<div class="cell seal">
		<img src={asset('/resources/scc.png')} alt="Virginia State Corporation Commission seal" width="72" height="72">
		<p class="mono">Registered with the Virginia State Corporation Commission.</p>
	</div>
</footer>

<div class="footer mono">
	<span>&copy; 2023&ndash;2026 AGR Holdings LLC. All rights reserved. AGR Holdings LLC is the office of <a href="https://alex9m.com">Alex</a></span>
</div>
