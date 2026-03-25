<script>
  import Router from 'svelte-spa-router';
  import Host from './routes/Host.svelte';
  import Phone from './routes/Phone.svelte';

  const routes = {
    '/': Host,
    '/play': Phone,
  };
</script>

<Router {routes} />
