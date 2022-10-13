const config = 
{
	"serverURL": 				"http://127.0.0.1:5000/upload_author_list",
	"sendData": 				false,														/* send data to server */
		"sendAuthorList": true,															/* send author list to server */
		"sendClientName": true,															/* send client name to server */
		"sendLog": 				true,															/* send log data to server */
	
	"enableLog": 				true,															/* enable/disable logger */
		"logConsole": 		true, 														/* log into console as well */
	
	"anonymouseClientName": "anonymouse",									/* client name if sendClientName false */
	"erroneousClientName": "anonymouse_error",						/* client name if scraping goes wrong */
}