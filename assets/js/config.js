const config = 
{
	"serverURL": 			"http://127.0.0.1:5000/upload_author_list", 		/* URL of server to send data */
	"sendAuthorList": true,																/* send collected author list to server */
	"sendClientName": true,																/* send client name to server */
	"sendLog": 				true,																/* send log data to server */
	"enableLog": 			true,																/* enable/disable logger */
	"logConsole": 		true, 															/* log into console as well */
	
	"anonymouseClientName": "anonymouse",									/* client name of if sendClientName false */
	"erroneousClientName": "anonymouse_error",						/* client name of if scraping goes wrong */
}