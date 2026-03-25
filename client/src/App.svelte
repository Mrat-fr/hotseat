<script>
  import Router from 'svelte-spa-router';
  import Landing from './routes/Landing.svelte';
  import Host from './routes/Host.svelte';
  import Phone from './routes/Phone.svelte';

  const routes = {
    '/': Landing,
    '/host': Host,
    '/play/:code': Phone,
  };
</script>

<Router {routes} />
