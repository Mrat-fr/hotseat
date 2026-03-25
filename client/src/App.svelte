<script>
  import Router from 'svelte-spa-router';
  import Host from './routes/Host.svelte';
  import Phone from './routes/Phone.svelte';
  import Admin from './routes/Admin.svelte';

  const routes = {
    '/': Host,
    '/play': Phone,
    '/admin': Admin,
  };
</script>

<Router {routes} />
