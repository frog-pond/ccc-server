get_docker_version() {
	# e.g. Docker version 20.10.17, build 100c701
	long_version="$(docker --version)"

	# remove 'Docker version' text, commmas, and whitespace
	short_version="$(echo $long_version | sed -e 's/Docker version//g' -e 's/,//g' | xargs)"

	# e.g. 20.10.17 build 100c701
	echo "$short_version"
}

get_docker_version
