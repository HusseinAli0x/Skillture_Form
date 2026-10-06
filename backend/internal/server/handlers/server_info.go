package handlers

import (
	"net"
	"net/http"

	"github.com/gin-gonic/gin"
)

// ServerInfo reports the addresses this machine can be reached on from the
// local network.
//
// A host who opens the app as http://localhost:5173 gets a join link and QR
// code that only work on their own computer. Players' phones need the
// machine's LAN address instead, so the lobby offers it as an alternative.
// Only private IPv4 addresses are returned: nothing here is secret (any device
// on the network can already see them), and public addresses are not useful
// for this purpose.
func ServerInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"lan_ips": lanIPv4Addresses()})
}

func lanIPv4Addresses() []string {
	ips := []string{}
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ips
	}
	for _, a := range addrs {
		ipnet, ok := a.(*net.IPNet)
		if !ok || ipnet.IP.IsLoopback() {
			continue
		}
		if ip4 := ipnet.IP.To4(); ip4 != nil && ip4.IsPrivate() {
			ips = append(ips, ip4.String())
		}
	}
	return ips
}
