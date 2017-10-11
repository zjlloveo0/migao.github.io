$one = "<div class='side'><div class='dot c'></div></div>";
$two = "<div class='side'><div class='dot tl'></div><div class='dot br'></div></div>";
$three = "<div class='side'><div class='dot tl'></div><div class='dot c'></div><div class='dot br'></div></div>";
$four = "<div class='side'><div class='dot tl'></div><div class='dot tr'></div><div class='dot bl'></div><div class='dot br'></div></div>";
$five = "<div class='side'><div class='dot tl'></div><div class='dot tr'></div><div class='dot c'></div><div class='dot bl'></div><div class='dot br'></div></div>";
$six = "<div class='side'><div class='dot tl'></div><div class='dot tr'></div><div class='dot cl'></div><div class='dot cr'></div><div class='dot bl'></div><div class='dot br'></div></div>";
$offset = 0;
function randomIntFromInterval(min,max) {
    return Math.floor(Math.random()*(max-min+1)+min);
}

function roll(){
  $newSides = 10;
  for($i=0; $i<$newSides; $i++){
    $s = "";
    $num = randomIntFromInterval(1, 6);
    if($num == 1){
      $s = $one;
    } else if($num == 2){
      $s = $two;
    } else if($num == 3){
      $s = $three;
    } else if($num == 4){
      $s = $four;
    } else if($num == 5){
      $s = $five;
    } else if($num == 6){
      $s = $six;
    }
    $('.dice').append($s);
  }
  $offset = $offset - (50*$newSides);
  $('.side:first-child').css('margin-top', $offset + "px");
}

$('.dice').on('click', roll);