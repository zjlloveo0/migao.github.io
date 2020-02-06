const countDownWrapper = document.getElementById('js-count-down');
countDownWrapper.addEventListener('click', ev => {
  countDownWrapper.style.display = 'none';
  setTimeout(() => {
    countDownWrapper.style.display = 'block';
  }, 0);
});