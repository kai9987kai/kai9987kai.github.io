function search() {
  // Get the search term
  var searchTerm = document.getElementById("search-input").value;

  // Get all the elements on the page
  var elements = document.querySelectorAll("*");

  // Loop through the elements and search for the search term
  for (var i = 0; i < elements.length; i++) {
    if (elements[i].innerText.includes(searchTerm)) {
      // If the search term is found, highlight the element
      elements[i].style.backgroundColor = "yellow";
    } else {
      // If the search term is not found, remove the highlight
      elements[i].style.backgroundColor = "";
    }
  }
}
