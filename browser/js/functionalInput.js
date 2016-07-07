var attackPending = false;

document.addEventListener('keypress', function (e) {
	var key;
	switch(e.keyCode) {
    case 97:
        key = 'ATTACK'; break;
    case 68:
        key = 'DEFENSE'; break;
    case 113: 
    	key = 'QUIT'; break;

      case 96:
      key = 'CHAT'; break;

    }
    if (key === 'ATTACK') {
    	attackModeOn();
    } else if (key === 'DEFENSE') {
        defenseModeOn();
    } else if (key === 'QUIT') {
    	if (attackPending) attackModeOff();
    }else if ( key === 'CHAT'){
        $('#chat-client').toggleClass('display-none');
    }

});