$(function() {
  $(document.body).on('click', '[data-secret-reveal]', function() {
    var id = $(this).data('secret-reveal');
    $(document.getElementById(id)).removeClass('secret-hidden');
    $(this).remove();
  });
});
