fetch("http://localhost:8000/api/health")
  .then(res => res.json())
  .then(data => {
    console.log("Backend Antwort:", data);
  });