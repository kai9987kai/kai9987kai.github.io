var form = document.querySelector("form");
form.addEventListener("submit", function(event) {
  event.preventDefault(); // Prevent the form from submitting
  search(); // Call the search function
});
